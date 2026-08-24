import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { RequestContext } from '../interfaces/request-context.interface';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { toError } from '../utils/error.util';

interface ErrorRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  requestContext?: RequestContext;
}

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: StructuredLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<ErrorRequest>();
    const error = toError(exception);
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestContext = request.requestContext;
    const requestId = requestContext?.requestId;
    const details = {
      requestId,
      statusCode,
      method: request.method,
      path: request.originalUrl ?? request.url,
      errorName: error.name,
      message: error.message,
      durationMs: requestContext
        ? Number(process.hrtime.bigint() - requestContext.startedAt) / 1e6
        : 0,
    };

    if (statusCode >= 500) {
      this.logger.error('http_request_failed', details, error.stack);
    } else {
      this.logger.warn('http_request_rejected', details);
    }

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const responseBody =
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object' &&
      !Array.isArray(exceptionResponse)
        ? { ...(exceptionResponse as Record<string, unknown>), requestId }
        : {
            statusCode,
            message:
              statusCode >= 500
                ? 'Internal server error'
                : (exceptionResponse ?? error.message),
            requestId,
          };

    this.httpAdapterHost.httpAdapter.reply(
      httpContext.getResponse(),
      responseBody,
      statusCode,
    );
  }
}
