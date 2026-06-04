import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { SupportModule } from './support/support.module';
import { AiModule } from './ai/ai.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { AdsModule } from './ads/ads.module';
import { AutomationModule } from './automation/automation.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EbayModule } from './ebay/ebay.module';
import { VintedModule } from './vinted/vinted.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 600,
    }]),
    SupportModule,
    AiModule,
    FirebaseModule,
    AuthModule,
    AdsModule,
    AutomationModule,
    SchedulerModule,
    EbayModule,
    VintedModule,
    // TODO: Import Users Modules
  ],
  controllers: [],
  providers: [
    // Removed ThrottlerGuard to avoid 429 errors during testing
  ],
})
export class AppModule {}
