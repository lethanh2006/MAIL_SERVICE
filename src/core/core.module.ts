import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from '../common/global-exception.filter';
import {
  StructuredLoggerService,
  TelemetryLifecycleService,
} from '../common/observability';
import { RequestIdMiddleware } from '../common/request-id.middleware';

@Global()
@Module({
  providers: [
    StructuredLoggerService,
    TelemetryLifecycleService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [StructuredLoggerService],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
