import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('optimize')
  async optimize(@Body() body: { title: string; description: string }) {
    return this.aiService.optimizeAd(body.title, body.description);
  }

  @Post('price')
  async suggestPrice(@Body() body: { title: string }) {
    return this.aiService.suggestPrice(body.title);
  }

  @Post('schedule')
  async calculateSchedule(@Body() body: { interval: 'Täglich' | 'Alle 3 Tage' | 'Wöchentlich' }) {
    return this.aiService.calculateScheduleInterval(body.interval);
  }
}
