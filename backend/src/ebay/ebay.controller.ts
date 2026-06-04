import { Controller, Get, Delete, Req, Res, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EbayService } from './ebay.service';

@Controller('api/ebay')
export class EbayController {
  constructor(private readonly ebayService: EbayService) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@Req() req: any, @Res() res: Response) {
    const authUrl = this.ebayService.getAuthUrl(req.user.userId);
    return res.redirect(authUrl);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    await this.ebayService.handleCallback(code, state);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/ebay/callback/success`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: any) {
    return this.ebayService.getStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  async disconnect(@Req() req: any) {
    return this.ebayService.disconnect(req.user.userId);
  }
}
