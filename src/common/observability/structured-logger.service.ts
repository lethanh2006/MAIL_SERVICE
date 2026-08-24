import { Injectable, Logger } from '@nestjs/common';

export type LogDetails = Record<string, unknown>;

@Injectable()
export class StructuredLoggerService {
  private readonly logger = new Logger('Mail');

  info(event: string, details: LogDetails): void {
    this.logger.log(this.serialize(event, details));
  }

  warn(event: string, details: LogDetails): void {
    this.logger.warn(this.serialize(event, details));
  }

  error(event: string, details: LogDetails, stack?: string): void {
    this.logger.error(this.serialize(event, details), stack);
  }

  private serialize(event: string, details: LogDetails): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'mail',
      event,
      ...details,
    });
  }
}
