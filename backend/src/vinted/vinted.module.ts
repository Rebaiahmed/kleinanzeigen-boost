import { Module } from '@nestjs/common';
import { VintedService } from './vinted.service';
import { VintedController } from './vinted.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [FirebaseModule, AutomationModule],
  controllers: [VintedController],
  providers: [VintedService],
  exports: [VintedService]
})
export class VintedModule {}
