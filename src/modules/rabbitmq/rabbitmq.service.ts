import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { randomUUID } from 'node:crypto';
import { toError } from '../../common/utils/error.util';
import { decideRetry, retryCountFrom } from './retry-policy';

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface RabbitMessage {
  content: unknown;
  queueName: string;
  requestId: string;
}

type MessageHandler = (message: RabbitMessage) => Promise<void>;

export interface RabbitSubscriptionOptions {
  retryQueue: string;
  deadLetterQueue: string;
  maxRetries: number;
  retryDelayMs: number;
}

interface RabbitSubscription {
  handler: MessageHandler;
  options: RabbitSubscriptionOptions;
}

export class NonRetryableMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = NonRetryableMessageError.name;
  }
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly subscriptions = new Map<string, RabbitSubscription>();
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private connectionPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConnection().catch((exception: unknown) => {
      this.logger.warn(
        `Không thể kết nối RabbitMQ: ${toError(exception).message}`,
      );
      this.scheduleReconnect();
    });
  }

  isReady(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  async subscribe(
    queueName: string,
    handler: MessageHandler,
    options: RabbitSubscriptionOptions,
  ): Promise<void> {
    this.subscriptions.set(queueName, { handler, options });
    if (this.channel) {
      await this.registerSubscription(queueName, handler, options);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }

  private ensureConnection(): Promise<void> {
    if (this.channel) return Promise.resolve();
    if (!this.connectionPromise) {
      this.connectionPromise = this.connect().finally(() => {
        this.connectionPromise = null;
      });
    }
    return this.connectionPromise;
  }

  private async connect(): Promise<void> {
    if (this.channel || this.shuttingDown) return;

    const connection = await amqp.connect({
      protocol: 'amqp',
      hostname: this.configService.getOrThrow<string>('RABBITMQ_HOST'),
      port: this.configService.getOrThrow<number>('RABBITMQ_PORT'),
      username: this.configService.getOrThrow<string>('RABBITMQ_USER'),
      password: this.configService.getOrThrow<string>('RABBITMQ_PASSWORD'),
    });
    const channel = await connection.createConfirmChannel();

    if (this.shuttingDown) {
      await channel.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
      return;
    }

    await channel.prefetch(
      this.configService.getOrThrow<number>('MAIL_PREFETCH'),
    );
    this.connection = connection;
    this.channel = channel;

    connection.on('error', (error: Error) => {
      this.logger.warn(`RabbitMQ connection error: ${error.message}`);
    });
    connection.on('close', () => this.handleDisconnect(connection));
    channel.on('error', (error: Error) => {
      this.logger.warn(`RabbitMQ channel error: ${error.message}`);
    });
    channel.on('close', () =>
      this.handleChannelUnavailable(channel, 'RabbitMQ channel closed'),
    );

    try {
      for (const [queueName, subscription] of this.subscriptions) {
        await this.registerSubscription(
          queueName,
          subscription.handler,
          subscription.options,
        );
      }
    } catch (exception: unknown) {
      this.connection = null;
      this.channel = null;
      await channel.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
      throw exception;
    }
    this.logger.log('Đã kết nối RabbitMQ');
  }

  private async registerSubscription(
    queueName: string,
    handler: MessageHandler,
    options: RabbitSubscriptionOptions,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) return;

    await channel.assertQueue(queueName, { durable: true });
    await channel.assertQueue(options.retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: queueName,
      messageTtl: options.retryDelayMs,
    });
    await channel.assertQueue(options.deadLetterQueue, { durable: true });
    await channel.consume(queueName, (message) => {
      if (!message) {
        this.handleChannelUnavailable(
          channel,
          `Consumer '${queueName}' bị broker hủy`,
        );
        return;
      }
      void this.processMessage(queueName, message, handler, options, channel);
    });
    this.logger.log(`Đang lắng nghe hàng đợi '${queueName}'`);
  }

  private async processMessage(
    queueName: string,
    message: amqp.ConsumeMessage,
    handler: MessageHandler,
    options: RabbitSubscriptionOptions,
    channel: amqp.ConfirmChannel,
  ): Promise<void> {
    const requestId = this.requestIdFrom(message);
    try {
      const content = this.parseContent(message);
      await handler({ content, queueName, requestId });
      channel.ack(message);
    } catch (exception: unknown) {
      const error = toError(exception);
      this.logger.error(
        JSON.stringify({
          event: 'rabbit_message_failed',
          queue: queueName,
          requestId,
          error: error.message,
        }),
        error.stack,
      );
      await this.moveFailedMessage(
        queueName,
        message,
        requestId,
        error,
        options,
        channel,
      );
    }
  }

  private parseContent(message: amqp.ConsumeMessage): unknown {
    try {
      return JSON.parse(message.content.toString()) as unknown;
    } catch {
      throw new NonRetryableMessageError(
        'Thông điệp RabbitMQ không phải JSON hợp lệ',
      );
    }
  }

  private async moveFailedMessage(
    queueName: string,
    message: amqp.ConsumeMessage,
    requestId: string,
    error: Error,
    options: RabbitSubscriptionOptions,
    channel: amqp.ConfirmChannel,
  ): Promise<void> {
    const decision = decideRetry(
      retryCountFrom(message.properties.headers),
      options.maxRetries,
      !(error instanceof NonRetryableMessageError),
    );
    const destination =
      decision.destination === 'retry'
        ? options.retryQueue
        : options.deadLetterQueue;
    const rawContentType: unknown = message.properties.contentType;
    const rawCorrelationId: unknown = message.properties.correlationId;
    const contentType =
      typeof rawContentType === 'string' && rawContentType.length > 0
        ? rawContentType
        : 'application/json';
    const correlationId =
      typeof rawCorrelationId === 'string' ? rawCorrelationId : undefined;
    const originalHeaders = recordFrom(message.properties.headers);

    try {
      channel.sendToQueue(destination, message.content, {
        persistent: true,
        contentType,
        correlationId,
        headers: {
          ...originalHeaders,
          'x-request-id': requestId,
          'x-original-queue': queueName,
          'x-retry-count': decision.nextRetryCount,
          'x-last-error': error.message.slice(0, 500),
        },
      });
      await channel.waitForConfirms();
      channel.ack(message);
      this.logger.warn(
        JSON.stringify({
          event:
            decision.destination === 'retry'
              ? 'rabbit_message_retry_scheduled'
              : 'rabbit_message_dead_lettered',
          queue: queueName,
          destination,
          requestId,
          retryCount: decision.nextRetryCount,
        }),
      );
    } catch (publishException: unknown) {
      this.logger.error(
        `Không thể chuyển message lỗi sang '${destination}': ${
          toError(publishException).message
        }`,
      );
      try {
        channel.nack(message, false, true);
      } catch (nackException: unknown) {
        this.logger.warn(
          `Không thể trả message gốc về hàng đợi: ${
            toError(nackException).message
          }`,
        );
      }
    }
  }

  private requestIdFrom(message: amqp.ConsumeMessage): string {
    const value: unknown = message.properties.headers?.['x-request-id'];
    return typeof value === 'string' && SAFE_REQUEST_ID.test(value)
      ? value
      : randomUUID();
  }

  private handleDisconnect(connection: amqp.ChannelModel): void {
    if (this.connection !== connection) return;
    this.connection = null;
    this.channel = null;
    if (this.shuttingDown) return;
    this.logger.warn('RabbitMQ đã ngắt kết nối, đang kết nối lại');
    this.scheduleReconnect();
  }

  private handleChannelUnavailable(
    channel: amqp.ConfirmChannel,
    reason: string,
  ): void {
    if (this.channel !== channel) return;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    if (this.shuttingDown) return;
    this.logger.warn(`${reason}, đang kết nối lại`);
    void connection?.close().catch(() => undefined);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnection().catch((exception: unknown) => {
        this.logger.warn(
          `Kết nối lại RabbitMQ thất bại: ${toError(exception).message}`,
        );
        this.scheduleReconnect();
      });
    }, 5_000);
    this.reconnectTimer.unref();
  }
}

function recordFrom(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}
