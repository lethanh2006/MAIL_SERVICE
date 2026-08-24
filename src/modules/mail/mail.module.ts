import { Module } from '@nestjs/common';
import { OtpMailConsumer } from './otp-mail.consumer';
import { MailSenderService } from './mail-sender.service';

@Module({
  providers: [MailSenderService, OtpMailConsumer],
  exports: [MailSenderService],
})
export class MailModule {}
