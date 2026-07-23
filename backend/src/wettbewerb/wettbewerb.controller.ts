import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WettbewerbService } from './wettbewerb.service';
import { CreateSavedSearchDto, AdIdBodyDto } from './dto/wettbewerb.dto';

@Controller('api/wettbewerb')
export class WettbewerbController {
  constructor(private readonly wettbewerbService: WettbewerbService) {}

  @UseGuards(JwtAuthGuard)
  @Get('searches')
  async listSearches(@Req() req: any) {
    return this.wettbewerbService.listSavedSearches(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches')
  async createSearch(@Req() req: any, @Body() body: CreateSavedSearchDto) {
    return this.wettbewerbService.createSavedSearch(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('searches/:id')
  async deleteSearch(@Req() req: any, @Param('id') id: string) {
    return this.wettbewerbService.deleteSavedSearch(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/recheck')
  async recheckSearch(@Req() req: any, @Param('id') id: string) {
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
    return this.wettbewerbService.applySuggestedPrice(req.user.userId, id, body.adId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/repost')
  async repost(@Req() req: any, @Param('id') _id: string, @Body() body: AdIdBodyDto) {
    return this.wettbewerbService.triggerRepostForSearch(req.user.userId, body.adId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('searches/:id/view')
  async markSearchViewed(@Req() req: any, @Param('id') id: string) {
    return this.wettbewerbService.markSearchViewed(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('guide-seen')
  async markGuideSeen(@Req() req: any) {
    return this.wettbewerbService.markGuideSeen(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  async getUsage(@Req() req: any) {
    return this.wettbewerbService.getUsage(req.user.userId);
  }
}
