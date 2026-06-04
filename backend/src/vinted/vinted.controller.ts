import { Controller, Get, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VintedService } from './vinted.service';

@Controller('api')
export class VintedController {
  constructor(private readonly vintedService: VintedService) {}

  @UseGuards(JwtAuthGuard)
  @Post('credentials/vinted')
  async connectVinted(@Req() req: any, @Body() body: any) {
    return this.vintedService.connectVinted(req.user.userId, body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vinted/status')
  async getStatus(@Req() req: any) {
    return this.vintedService.getStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('vinted/disconnect')
  async disconnect(@Req() req: any) {
    return this.vintedService.disconnect(req.user.userId);
  }
}
