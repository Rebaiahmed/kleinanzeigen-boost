import { Controller, Get, Post, Param, Body, UseGuards, Req, Patch } from '@nestjs/common';
import { AdsService } from './ads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateAdDto } from './dto/update-ad.dto';
import { SaveDraftDto } from './dto/save-draft.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  async getAds(@Req() req: any) {
    return this.adsService.getAds(req.user.userId);
  }

  /** Called by the extension background after it fetches ads from Kleinanzeigen */
  @Post('import')
  async importAds(@Req() req: any, @Body() body: { ads: any[] }) {
    return this.adsService.importAds(req.user.userId, body.ads || []);
  }

  @Get('scheduler-status')
  async getSchedulerStatus() {
    return this.adsService.getSchedulerStatus();
  }

  @Post('sync')
  async syncAds(@Req() req: any) {
    return this.adsService.syncAds(req.user.userId);
  }

  @Post('add')
  async addAd(@Req() req: any, @Body() adData: any) {
    return this.adsService.addAd(req.user.userId, adData);
  }

  @Post('repost/:id')
  async repostAd(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.repostAd(req.user.userId, adId);
  }

  // Phase 1 (non-destructive): capture the ad's fields + photos so we can verify
  // we can rebuild it BEFORE any delete logic exists. Deletes nothing.
  @Post('repost-snapshot/:id')
  async repostSnapshot(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.snapshotAd(req.user.userId, adId);
  }

  @Post('reserve/:id')
  async toggleReserve(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.toggleReserve(req.user.userId, adId);
  }

  @Post('toggle-repost/:id')
  async toggleAutoRepost(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.toggleAutoRepost(req.user.userId, adId);
  }

  @Post('activate/:id')
  async activateAd(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.activateAd(req.user.userId, adId);
  }

  @Post('pause/:id')
  async pauseAd(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.pauseAd(req.user.userId, adId);
  }

  @Post('delete/:id')
  async deleteAd(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.deleteAd(req.user.userId, adId);
  }

  @Post('draft')
  async saveDraft(@Req() req: any, @Body() adData: SaveDraftDto) {
    return this.adsService.saveDraft(req.user.userId, adData);
  }

  @Patch(':id')
  async updateAd(
    @Req() req: any,
    @Param('id') adId: string,
    @Body() body: UpdateAdDto,
  ) {
    return this.adsService.updateAd(req.user.userId, adId, body);
  }

  @Post(':id/cross-post/ebay')
  async crossPostEbay(
    @Req() req: any,
    @Param('id') adId: string
  ) {
    return this.adsService.crossPostEbay(req.user.userId, adId);
  }

  @Post(':id/cross-post/vinted')
  async crossPostVinted(
    @Req() req: any,
    @Param('id') adId: string
  ) {
    return this.adsService.crossPostVinted(req.user.userId, adId);
  }
}
