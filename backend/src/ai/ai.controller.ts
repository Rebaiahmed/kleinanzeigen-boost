import { Controller, Post, Body, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { Observable } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('optimize-ad')
  async optimizeAd(@Body('adId') adId: string) {
    // Requires Auth guard + userId from token
    const userId = 'stub-user-id';
    return this.aiService.optimizeAd(adId, userId);
  }

  @Post('suggest-price')
  async suggestPrice(@Body('adId') adId: string) {
    const userId = 'stub-user-id';
    return this.aiService.suggestPrice(adId, userId);
  }

  @Post('suggest-schedule')
  async suggestSchedule(@Body('adId') adId: string) {
    const userId = 'stub-user-id'; // MUST check if Pro plan here or in service
    return this.aiService.suggestSchedule(adId, userId);
  }

  @Sse('chat')
  async chat(@Body('message') message: string, @Body('context') context: any): Promise<Observable<any>> {
    const userId = 'stub-user-id';
    return this.aiService.chat(message, userId, context);
  }
}
