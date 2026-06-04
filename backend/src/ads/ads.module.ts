import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [FirebaseModule, AutomationModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService]
})
export class AdsModule {}
