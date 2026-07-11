import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WettbewerbService } from './wettbewerb.service';
import { CreateSavedSearchDto, AdIdBodyDto } from './dto/wettbewerb.dto';
import { FEATURE_FLAGS } from '../config/feature-flags';

@Controller('api/wettbewerb')
export class WettbewerbController {
  constructor(private readonly wettbewerbService: WettbewerbService) {}

  /** Every route goes through this so the flag is a real backend guarantee,
   *  not just a client-side convention — mirrors CreditsController. */
  private assertEnabled() {
    if (!FEATURE_FLAGS.enableWettbewerb) {
      throw new HttpException({ message: 'Wettbewerb ist nicht aktiviert.', code: 'WETTBEWERB_DISABLED' }, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('searches')
  async listSearches(@Req() req: any) {
    this.assertEnabled();
    return this.wettbewerbService.listSavedSearches(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches')
  async createSearch(@Req() req: any, @Body() body: CreateSavedSearchDto) {
    this.assertEnabled();
    return this.wettbewerbService.createSavedSearch(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('searches/:id')
  async deleteSearch(@Req() req: any, @Param('id') id: string) {
    this.assertEnabled();
    return this.wettbewerbService.deleteSavedSearch(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/recheck')
  async recheckSearch(@Req() req: any, @Param('id') id: string) {
    this.assertEnabled();
    const userId = req.user.userId;
    const searchDoc = await this.wettbewerbService.listSavedSearches(userId);
    const search = searchDoc.searches.find((s: any) => s.id === id);
    if (!search) {
      throw new HttpException({ message: 'Suche nicht gefunden.' }, HttpStatus.NOT_FOUND);
    }
    const runId = `manual-${Date.now()}`;
    await this.wettbewerbService.performCheck(userId, id, search, runId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/apply-price')
  async applyPrice(@Req() req: any, @Param('id') id: string, @Body() body: AdIdBodyDto) {
    this.assertEnabled();
    return this.wettbewerbService.applySuggestedPrice(req.user.userId, id, body.adId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/repost')
  async repost(@Req() req: any, @Param('id') _id: string, @Body() body: AdIdBodyDto) {
    this.assertEnabled();
    return this.wettbewerbService.triggerRepostForSearch(req.user.userId, body.adId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('guide-seen')
  async markGuideSeen(@Req() req: any) {
    this.assertEnabled();
    return this.wettbewerbService.markGuideSeen(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  async getUsage(@Req() req: any) {
    this.assertEnabled();
    return this.wettbewerbService.getUsage(req.user.userId);
  }
}
