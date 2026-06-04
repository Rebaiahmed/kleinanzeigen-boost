import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFiles, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';

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

  @Post('analyze-photos')
  @UseInterceptors(FilesInterceptor('images', 8, {
    limits: { fileSize: 4 * 1024 * 1024 } // 4MB
  }))
  async analyzePhotos(
    @UploadedFiles() files: any[],
    @Body('hint') hint: string,
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new HttpException('Mindestens ein Foto muss hochgeladen werden.', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.analyzePhotos(req.user.userId, files, hint);
  }
}
