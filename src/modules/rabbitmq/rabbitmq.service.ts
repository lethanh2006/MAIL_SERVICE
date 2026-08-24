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

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface RabbitMessage {
  content: unknown;
  queueName: string;
  requestId: string;
}

type MessageHandler = (message: RabbitMessage) => Promise<void>;

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly subscriptions = new Map<string, MessageHandler>();
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
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

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    this.subscriptions.set(queueName, handler);
    if (this.channel) await this.registerSubscription(queueName, handler);
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
    const channel = await connection.createChannel();

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

    for (const [queueName, handler] of this.subscriptions) {
      await this.registerSubscription(queueName, handler);
    }
    this.logger.log('Đã kết nối RabbitMQ');
  }

  private async registerSubscription(
    queueName: string,
    handler: MessageHandler,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) return;

    await channel.assertQueue(queueName, { durable: true });
    await channel.consume(queueName, (message) => {
      if (!message) {
        this.handleChannelUnavailable(
          channel,
          `Consumer '${queueName}' bị broker hủy`,
        );
        return;
      }
      void this.processMessage(queueName, message, handler, channel);
    });
    this.logger.log(`Đang lắng nghe hàng đợi '${queueName}'`);
  }

  private async processMessage(
    queueName: string,
    message: amqp.ConsumeMessage,
    handler: MessageHandler,
    channel: amqp.Channel,
  ): Promise<void> {
    const requestId = this.requestIdFrom(message);
    try {
      const content = JSON.parse(message.content.toString()) as unknown;
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
      channel.nack(message, false, true);
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
    channel: amqp.Channel,
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
