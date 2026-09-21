import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { flushLogger, logException } from '@nrapp/observability';
import { AppModule } from './app.module';
import { appLogger, nestLogger } from './common/logging/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: nestLogger,
  });
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');

  appLogger.info(
    {
      'event.name': 'service.started',
      'server.port': port,
    },
    'Mail service đã khởi động',
  );
}

void bootstrap().catch(async (error: unknown) => {
  logException(
    appLogger,
    'process.bootstrap.failed',
    error,
    {},
    {
      message: 'Không thể khởi động dịch vụ thư',
      classification: {
        statusCode: 500,
        code: 'BOOTSTRAP_FAILED',
        expected: false,
        retryable: false,
        logLevel: 'fatal',
      },
    },
  );
  await flushLogger(appLogger);
  process.exitCode = 1;
});
