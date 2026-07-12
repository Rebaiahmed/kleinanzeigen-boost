import { Module } from '@nestjs/common';
import { WettbewerbController } from './wettbewerb.controller';
import { WettbewerbService } from './wettbewerb.service';
import { PlzValidationService } from './plz-validation.service';
import { WettbewerbCreditsStub } from './wettbewerb-credits.stub';
import { FirebaseModule } from '../firebase/firebase.module';
import { AutomationModule } from '../automation/automation.module';
import { AdsModule } from '../ads/ads.module';

@Module({
  imports: [FirebaseModule, AutomationModule, AdsModule],
  controllers: [WettbewerbController],
  providers: [WettbewerbService, PlzValidationService, WettbewerbCreditsStub],
  exports: [WettbewerbService],
})
export class WettbewerbModule {}
