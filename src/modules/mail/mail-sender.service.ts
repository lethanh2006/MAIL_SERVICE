import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { toError } from '../../common/utils/error.util';
import type { SendMailMessageDto } from './dto/send-mail-message.dto';

@Injectable()
export class MailSenderService implements OnModuleDestroy {
  private static readonly SUCCESS_CACHE_MS = 60_000;
  private static readonly FAILURE_CACHE_MS = 15_000;
  private readonly logger = new Logger(MailSenderService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private smtpReady = false;
  private verifyAfter = 0;
  private verificationPromise: Promise<boolean> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.from = configService.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: configService.getOrThrow<number>('SMTP_PORT'),
      secure: configService.getOrThrow<boolean>('SMTP_SECURE'),
      connectionTimeout: configService.getOrThrow<number>(
        'SMTP_CONNECTION_TIMEOUT_MS',
      ),
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async send(message: SendMailMessageDto): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      });
      this.cacheVerification(true);
    } catch (exception: unknown) {
      this.cacheVerification(false);
      throw exception;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (Date.now() < this.verifyAfter) return this.smtpReady;
    if (!this.verificationPromise) {
      this.verificationPromise = this.verifyTransport().finally(() => {
        this.verificationPromise = null;
      });
    }
    return this.verificationPromise;
  }

  private async verifyTransport(): Promise<boolean> {
    try {
      const ready = await this.transporter.verify();
      this.cacheVerification(ready);
      return ready;
    } catch (exception: unknown) {
      this.logger.warn(`SMTP chưa sẵn sàng: ${toError(exception).message}`);
      this.cacheVerification(false);
      return false;
    }
  }

  private cacheVerification(ready: boolean): void {
    this.smtpReady = ready;
    this.verifyAfter =
      Date.now() +
      (ready
        ? MailSenderService.SUCCESS_CACHE_MS
        : MailSenderService.FAILURE_CACHE_MS);
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
