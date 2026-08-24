type RawEnvironment = Record<string, unknown>;

export interface MailEnvironment extends RawEnvironment {
  PORT: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  MAIL_FROM: string;
  RABBITMQ_HOST: string;
  RABBITMQ_PORT: number;
  RABBITMQ_USER: string;
  RABBITMQ_PASSWORD: string;
  MAIL_QUEUE: string;
  MAIL_PREFETCH: number;
}

export function validateEnvironment(config: RawEnvironment): MailEnvironment {
  const smtpUser = requiredString(config, 'SMTP_USER');

  return {
    ...config,
    PORT: integer(config.PORT, 5001, 'PORT', 1, 65_535),
    SMTP_HOST: optionalString(config.SMTP_HOST, 'smtp.gmail.com'),
    SMTP_PORT: integer(config.SMTP_PORT, 465, 'SMTP_PORT', 1, 65_535),
    SMTP_SECURE: booleanValue(config.SMTP_SECURE, true, 'SMTP_SECURE'),
    SMTP_USER: smtpUser,
    SMTP_PASS: requiredString(config, 'SMTP_PASS'),
    MAIL_FROM: optionalString(config.MAIL_FROM, smtpUser),
    RABBITMQ_HOST: optionalString(
      config.RABBITMQ_HOST ?? config.Rabbitmq_Host,
      'localhost',
    ),
    RABBITMQ_PORT: integer(
      config.RABBITMQ_PORT ??
        config.RABBITMQ_AMQP_HOST_PORT ??
        config.Rabbitmq_Port,
      5672,
      'RABBITMQ_PORT',
      1,
      65_535,
    ),
    RABBITMQ_USER: optionalString(
      config.RABBITMQ_USER ?? config.Rabbitmq_Username,
      'guest',
    ),
    RABBITMQ_PASSWORD: optionalString(
      config.RABBITMQ_PASSWORD ?? config.Rabbitmq_Password,
      'guest',
    ),
    MAIL_QUEUE: optionalString(config.MAIL_QUEUE, 'send-otp'),
    MAIL_PREFETCH: integer(config.MAIL_PREFETCH, 5, 'MAIL_PREFETCH', 1, 100),
  };
}

function requiredString(config: RawEnvironment, name: string): string {
  const value = config[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Thiếu biến môi trường bắt buộc ${name}`);
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function integer(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} phải là số nguyên từ ${minimum} đến ${maximum}`);
  }
  return parsed;
}

function booleanValue(
  value: unknown,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${name} chỉ chấp nhận true hoặc false`);
}
