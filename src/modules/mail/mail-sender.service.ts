import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { toError } from '../../common/utils/error.util';
import type { SendMailMessageDto } from './dto/send-mail-message.dto';

@Injectable()
export class MailSenderService implements OnModuleDestroy {
  private readonly logger = new Logger(MailSenderService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = configService.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: configService.getOrThrow<number>('SMTP_PORT'),
      secure: configService.getOrThrow<boolean>('SMTP_SECURE'),
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async send(message: SendMailMessageDto): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      return await this.transporter.verify();
    } catch (exception: unknown) {
      this.logger.warn(`SMTP chưa sẵn sàng: ${toError(exception).message}`);
      return false;
    }
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
