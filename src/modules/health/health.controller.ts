import { Controller, Get } from '@nestjs/common';
import { HealthService, type MailHealth } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): Promise<MailHealth> {
    return this.healthService.getReadiness();
  }

  @Get('live')
  getLiveness(): MailHealth {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<MailHealth> {
    return this.healthService.getReadiness();
  }
}
