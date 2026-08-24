import '@nrapp/observability/register';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PinoNestLogger, shutdownTelemetry } from '@nrapp/observability';
import { AppModule } from './app.module';
import { appLogger } from './common/observability/app-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new PinoNestLogger(appLogger, 'NestApplication'),
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

void bootstrap().catch(async (exception: unknown) => {
  const error =
    exception instanceof Error ? exception : new Error(String(exception));
  appLogger.fatal(
    {
      'event.name': 'service.bootstrap.failed',
      error,
    },
    'Không thể khởi động dịch vụ mail',
  );
  appLogger.flush();
  await shutdownTelemetry(3_000);
  process.exitCode = 1;
});
