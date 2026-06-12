import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  /** Manual trigger for dev/testing — runs the full cron logic immediately */
  @UseGuards(JwtAuthGuard)
  @Post('trigger')
  async trigger() {
    await this.schedulerService.triggerNow();
    return { success: true, message: 'Scheduler triggered manually' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status() {
    return this.schedulerService.getStatus();
  }

  /** List all scheduled (pending) reposts for the logged-in user. */
  @UseGuards(JwtAuthGuard)
  @Get('scheduled')
  async getScheduledReposts(@Req() req: any) {
    return this.schedulerService.getUserScheduledReposts(req.user.userId);
  }
}
