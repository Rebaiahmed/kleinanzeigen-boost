import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// FirebaseService is provided globally (FirebaseModule is @Global).
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
