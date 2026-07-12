import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { AutomationModule } from '../automation/automation.module';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WettbewerbModule } from '../wettbewerb/wettbewerb.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [AutomationModule, AuthModule, FirebaseModule, NotificationsModule, WettbewerbModule, CreditsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
