import { Controller, Post, Get, Body, UseGuards, UseInterceptors, UploadedFiles, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { FirebaseService } from '../firebase/firebase.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from '../common/constants/upload.constants';

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly firebaseService: FirebaseService,
  ) {}

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

  // Rate-limit the expensive vision endpoint: max 10 requests/minute per IP.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post('analyze-photos')
  @UseInterceptors(FilesInterceptor('images', MAX_PHOTOS, {
    limits: { fileSize: MAX_PHOTO_BYTES },
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

  // Price suggestion POC: analyze ad + suggest price using mock comparables + LLM
  @UseGuards(JwtAuthGuard)
  @Post('suggest-price')
  async suggestPriceForAd(
    @Req() req: any,
    @Body() body: { adId: string }
  ) {
    console.log(`[Price Suggestion] Request for ad ${body.adId}`);
    try {
      // Fetch the ad
      const db = this.firebaseService.firestore;
      const adDoc = await db.collection('users').doc(req.user.userId).collection('ads').doc(String(body.adId)).get();
      if (!adDoc.exists) throw new Error('Ad not found');
      const ad = { id: adDoc.id, ...adDoc.data() };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const priceSuggestionService = new (require('./price-suggestion.service').PriceSuggestionService)();
      const result = await priceSuggestionService.suggestPrice(this.aiService, ad);
      console.log(`[Price Suggestion] ✅ Suggested ${result.suggestedLow}-${result.suggestedHigh}€`);
      return result;
    } catch (err: any) {
      console.error(`[Price Suggestion] ❌ Error: ${err.message}`);
      throw err;
    }
  }

  // Photo feedback: analyze ad photos for quality score + suggestions (metered, cached)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post('photo-feedback')
  async getPhotoFeedback(
    @Req() req: any,
    @Body() body: { adId: string }
  ) {
    const startTime = Date.now();
    const userId = req.user?.userId;
    const adId = body?.adId;

    console.log(`[Photo Feedback API] 📸 Request received — userId: ${userId}, adId: "${adId}", body:`, body);

    if (!userId) {
      throw new HttpException('Authentifizierung erforderlich', HttpStatus.UNAUTHORIZED);
    }
    if (!adId || typeof adId !== 'string' || adId.trim() === '') {
      console.error(`[Photo Feedback API] ❌ Invalid adId: "${adId}" (type: ${typeof adId})`);
      throw new HttpException('Ad ID ist erforderlich', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.aiService.getPhotoFeedback(userId, adId);
      const elapsed = Date.now() - startTime;
      console.log(`[Photo Feedback API] ✅ Success — ${elapsed}ms, overall: ${result.overall}, scoreKeys: ${Object.keys(result.scores).join(', ')}`);
      return result;
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Photo Feedback API] ❌ Error after ${elapsed}ms — ${err.message}`);
      throw err;
    }
  }
}
