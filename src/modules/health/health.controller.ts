import { Controller, Get } from '@nestjs/common';
import { HealthService, type MailHealth } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): MailHealth {
    return this.healthService.getReadiness();
  }

  @Get('live')
  getLiveness(): MailHealth {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): MailHealth {
    return this.healthService.getReadiness();
  }
}
