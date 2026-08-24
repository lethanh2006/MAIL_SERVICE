import { ServiceUnavailableException } from '@nestjs/common';
import type { MailSenderService } from '../mail/mail-sender.service';
import type { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const rabbitMqService = {
    isReady: jest.fn<boolean, []>(),
  };
  const mailSenderService = {
    verifyConnection: jest.fn<Promise<boolean>, []>(),
  };
  const service = new HealthService(
    rabbitMqService as unknown as RabbitMqService,
    mailSenderService as unknown as MailSenderService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('ready khi RabbitMQ và SMTP đều hoạt động', async () => {
    rabbitMqService.isReady.mockReturnValue(true);
    mailSenderService.verifyConnection.mockResolvedValue(true);

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ok',
      service: 'mail',
      dependencies: { rabbitmq: 'up', smtp: 'up' },
    });
  });

  it('trả 503 khi SMTP không sẵn sàng', async () => {
    rabbitMqService.isReady.mockReturnValue(true);
    mailSenderService.verifyConnection.mockResolvedValue(false);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
