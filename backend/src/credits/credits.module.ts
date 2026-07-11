import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { CreditsController } from './credits.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [CreditsController],
  providers: [CreditsService, StripeService],
  exports: [CreditsService],
})
export class CreditsModule {}
