import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [MailModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
