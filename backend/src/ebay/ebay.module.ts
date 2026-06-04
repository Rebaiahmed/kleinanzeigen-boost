import { Module } from '@nestjs/common';
import { EbayService } from './ebay.service';
import { EbayController } from './ebay.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [EbayController],
  providers: [EbayService],
  exports: [EbayService],
})
export class EbayModule {}
