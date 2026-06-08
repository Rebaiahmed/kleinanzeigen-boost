import { Controller, Post, Get, Body, UseGuards, UseInterceptors, UploadedFiles, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * GET /api/ai/health (no auth guard — used by the panel health indicator)
   * Calls Gemini with a minimal prompt and returns response time in ms.
   */
  @Get('health')
  async health() {
    return this.aiService.healthCheck();
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  async getAiUsage(@Req() req: any) {
    return this.aiService.getUserUsage(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('optimize')
  async optimize(
    @Req() req: any,
    @Body() body: { title: string; description: string; category?: string }
  ) {
    console.log(`[KI-Opt] optimize called — userId: ${req.user?.userId}`);
    return this.aiService.optimizeExistingAd(
      req.user.userId,
      body.title,
      body.description,
      body.category || 'Sonstiges'
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('optimize-ad')
  async optimizeAd(
    @Req() req: any,
    @Body() body: { title: string; description: string; category: string }
  ) {
    console.log(`[KI-Opt] optimize-ad called — userId: ${req.user?.userId}, title: "${body.title?.slice(0, 40)}"`);
    return this.aiService.optimizeExistingAd(
      req.user.userId,
      body.title,
      body.description,
      body.category
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('price')
  async suggestPrice(
    @Req() req: any,
    @Body() body: { title: string }
  ) {
    return this.aiService.suggestPrice(req.user.userId, body.title);
  }

  @UseGuards(JwtAuthGuard)
  @Post('schedule')
  async calculateSchedule(@Body() body: { interval: 'Täglich' | 'Alle 3 Tage' | 'Wöchentlich' }) {
    return this.aiService.calculateScheduleInterval(body.interval);
  }

  @UseGuards(JwtAuthGuard)
  @Post('suggest-repost-time')
  async suggestRepostTime(
    @Req() req: any,
    @Body() body: { adId: string }
  ) {
    return this.aiService.suggestRepostTime(req.user.userId, body.adId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('analyze-photos')
  @UseInterceptors(FilesInterceptor('images', 8, {
    limits: { fileSize: 4 * 1024 * 1024 } // 4MB
  }))
  async analyzePhotos(
    @UploadedFiles() files: any[],
    @Body('hint') hint: string,
    @Body('language') language: string,
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new HttpException('Mindestens ein Foto muss hochgeladen werden.', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.analyzePhotos(req.user.userId, files, hint, language);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reply-suggestions')
  async replySuggestions(
    @Req() req: any,
    @Body() body: { messageHistory: string[] }
  ) {
    if (!body.messageHistory || !Array.isArray(body.messageHistory)) {
      throw new HttpException('messageHistory Array ist erforderlich.', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.suggestReply(req.user.userId, body.messageHistory);
  }
}
