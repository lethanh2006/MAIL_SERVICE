import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';
import { StructuredLoggerService } from '../common/observability/structured-logger.service';
import { TelemetryLifecycleService } from '../common/observability/telemetry-lifecycle.service';

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
