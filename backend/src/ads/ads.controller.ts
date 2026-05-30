import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AdsService } from './ads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('sync')
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

  @Post('reserve/:id')
  async toggleReserve(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.toggleReserve(req.user.userId, adId);
  }

  @Post('toggle-repost/:id')
  async toggleAutoRepost(@Req() req: any, @Param('id') adId: string) {
    return this.adsService.toggleAutoRepost(req.user.userId, adId);
  }
}
