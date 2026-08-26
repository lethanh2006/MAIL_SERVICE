import { createAppLogger, PinoNestLogger } from '@nrapp/observability';

export const appLogger: ReturnType<typeof createAppLogger> = createAppLogger({
  serviceName: 'mail',
});

export const nestLogger = new PinoNestLogger(appLogger, 'Mail');
