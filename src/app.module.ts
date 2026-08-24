import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { CoreModule } from './core/core.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: validateEnvironment,
    }),
    CoreModule,
    RabbitMqModule,
    MailModule,
    HealthModule,
  ],
})
export class AppModule {}
