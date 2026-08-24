import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { toError } from './common/utils/error.util';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(
    `Mail Service NestJS is running on: http://localhost:${port}`,
  );
}

void bootstrap().catch((exception: unknown) => {
  const error = toError(exception);
  new Logger('Bootstrap').error(
    `Không thể khởi động dịch vụ mail: ${error.message}`,
    error.stack,
  );
  process.exitCode = 1;
});
