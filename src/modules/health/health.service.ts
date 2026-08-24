import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

export interface MailHealth {
  status: 'ok' | 'error';
  service: 'mail';
  dependencies?: {
    rabbitmq: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly rabbitMqService: RabbitMqService) {}

  getLiveness(): MailHealth {
    return { status: 'ok', service: 'mail' };
  }

  getReadiness(): MailHealth {
    const dependencies = {
      rabbitmq: this.rabbitMqService.isReady()
        ? ('up' as const)
        : ('down' as const),
    };
    const result: MailHealth = {
      status: dependencies.rabbitmq === 'up' ? 'ok' : 'error',
      service: 'mail',
      dependencies,
    };

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
