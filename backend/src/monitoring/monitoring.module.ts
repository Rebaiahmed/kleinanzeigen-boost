import { Module } from '@nestjs/common';
import { CreditMonitorService } from './credit-monitor.service';

/** Background health/cost monitoring (OpenRouter credit alerts, …). */
@Module({
  providers: [CreditMonitorService],
})
export class MonitoringModule {}
