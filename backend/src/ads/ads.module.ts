import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AutomationModule } from '../automation/automation.module';
import { EbayModule } from '../ebay/ebay.module';
import { VintedModule } from '../vinted/vinted.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [FirebaseModule, AutomationModule, EbayModule, VintedModule, AuthModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService]
})
export class AdsModule {}
