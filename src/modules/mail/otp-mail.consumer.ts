import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { appLogger } from '../../common/observability/app-logger';
import {
  NonRetryableMessageError,
  RabbitMQService,
  type RabbitMessage,
  type RabbitSubscriptionOptions,
} from '../rabbitmq/rabbitmq.service';
import { SendMailMessageDto } from './dto/send-mail-message.dto';
import { MailSenderService } from './mail-sender.service';

@Injectable()
export class OtpMailConsumer implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly mailSenderService: MailSenderService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queueName = this.configService.getOrThrow<string>('MAIL_QUEUE');
    const options: RabbitSubscriptionOptions = {
      retryQueue: this.configService.getOrThrow<string>('MAIL_RETRY_QUEUE'),
      deadLetterQueue: this.configService.getOrThrow<string>(
        'MAIL_DEAD_LETTER_QUEUE',
      ),
      maxRetries: this.configService.getOrThrow<number>('MAIL_MAX_RETRIES'),
      retryDelayMs: this.configService.getOrThrow<number>(
        'MAIL_RETRY_DELAY_MS',
      ),
    };
    await this.rabbitMQService.subscribe(
      queueName,
      (message) => this.handleMessage(message),
      options,
    );
  }

  private async handleMessage(message: RabbitMessage): Promise<void> {
    const dto = plainToInstance(SendMailMessageDto, message.content);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new NonRetryableMessageError(
        'Thông điệp gửi mail không đúng định dạng',
      );
    }

    await this.mailSenderService.send(dto);
    appLogger.info(
      {
        'event.name': 'mail.delivery.completed',
        'messaging.system': 'rabbitmq',
        'messaging.destination.name': message.queueName,
        'messaging.message.retry_count': message.retryCount,
        request_id: message.requestId,
      },
      'Mail đã được gửi thành công',
    );
  }
}
