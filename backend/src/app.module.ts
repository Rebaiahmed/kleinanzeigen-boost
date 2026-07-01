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
import { ReplyTemplatesModule } from './reply-templates/reply-templates.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ConfigController } from './config/config.controller';
import { HealthController } from './health/health.controller';

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
    ReplyTemplatesModule,
    AdminModule,
    NotificationsModule,
    MonitoringModule,
    // TODO: Import Users Modules
  ],
  controllers: [ConfigController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
