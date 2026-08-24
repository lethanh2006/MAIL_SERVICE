import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { toError } from '../../common/utils/error.util';
import {
  RabbitMqService,
  type RabbitMessage,
} from '../rabbitmq/rabbitmq.service';
import { SendMailMessageDto } from './dto/send-mail-message.dto';
import { MailSenderService } from './mail-sender.service';

@Injectable()
export class OtpMailConsumer implements OnModuleInit {
  private readonly logger = new Logger(OtpMailConsumer.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitMqService: RabbitMqService,
    private readonly mailSenderService: MailSenderService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queueName = this.configService.getOrThrow<string>('MAIL_QUEUE');
    await this.rabbitMqService.subscribe(queueName, (message) =>
      this.handleMessage(message),
    );
  }

  private async handleMessage(message: RabbitMessage): Promise<void> {
    const dto = plainToInstance(SendMailMessageDto, message.content);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new Error('Thông điệp gửi mail không đúng định dạng');
    }

    try {
      await this.mailSenderService.send(dto);
      this.logger.log(
        JSON.stringify({
          event: 'mail_delivery_completed',
          queue: message.queueName,
          requestId: message.requestId,
        }),
      );
    } catch (exception: unknown) {
      const error = toError(exception);
      this.logger.error(
        JSON.stringify({
          event: 'mail_delivery_failed',
          queue: message.queueName,
          requestId: message.requestId,
          error: error.message,
        }),
      );
      throw error;
    }
  }
}
