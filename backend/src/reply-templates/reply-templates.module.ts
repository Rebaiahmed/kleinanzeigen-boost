import { Module } from '@nestjs/common';
import { ReplyTemplatesService } from './reply-templates.service';
import { ReplyTemplatesController } from './reply-templates.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [ReplyTemplatesService],
  controllers: [ReplyTemplatesController]
})
export class ReplyTemplatesModule {}
