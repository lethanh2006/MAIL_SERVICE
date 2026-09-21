import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { LoggerLifecycleService } from '../common/logging/logger';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';

@Global()
@Module({
  providers: [
    LoggerLifecycleService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
