import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AutomationModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
