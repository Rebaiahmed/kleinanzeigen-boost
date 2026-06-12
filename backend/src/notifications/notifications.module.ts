import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    FirebaseModule,
    // Same secret as AuthModule so SSE tokens verify identically.
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET || 'fallback_secret_for_dev' }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
