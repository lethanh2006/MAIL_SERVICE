import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from '../common/interceptors/http-logging.interceptor';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';
import { StructuredLoggerService } from '../common/observability/structured-logger.service';

@Global()
@Module({
  providers: [
    StructuredLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
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
