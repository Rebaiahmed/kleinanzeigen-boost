import { Module } from '@nestjs/common';
import { WettbewerbController } from './wettbewerb.controller';
import { WettbewerbService } from './wettbewerb.service';
import { PlzValidationService } from './plz-validation.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AutomationModule } from '../automation/automation.module';
import { AdsModule } from '../ads/ads.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FirebaseModule, AutomationModule, AdsModule, CreditsModule, NotificationsModule],
  controllers: [WettbewerbController],
  providers: [WettbewerbService, PlzValidationService],
  exports: [WettbewerbService],
})
export class WettbewerbModule {}
