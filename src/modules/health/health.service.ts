import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MailSenderService } from '../mail/mail-sender.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

export interface MailHealth {
  status: 'ok' | 'error';
  service: 'mail';
  dependencies?: {
    rabbitmq: 'up' | 'down';
    smtp: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly mailSenderService: MailSenderService,
  ) {}

  getLiveness(): MailHealth {
    return { status: 'ok', service: 'mail' };
  }

  async getReadiness(): Promise<MailHealth> {
    const dependencies = {
      rabbitmq: this.rabbitMqService.isReady()
        ? ('up' as const)
        : ('down' as const),
      smtp: (await this.mailSenderService.verifyConnection())
        ? ('up' as const)
        : ('down' as const),
    };
    const result: MailHealth = {
      status: Object.values(dependencies).every((value) => value === 'up')
        ? 'ok'
        : 'error',
      service: 'mail',
      dependencies,
    };

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
