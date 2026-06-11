import { Controller, Post, Get, Body, Req, UseGuards, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaidPlan } from '../config/billing.constants';

@Controller('api/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Public: lets the frontend decide whether to show upgrade UI. */
  @Get('status')
  status() {
    return { enabled: this.billingService.isEnabled() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req: any, @Body() body: { plan: PaidPlan }) {
    if (body?.plan !== 'starter' && body?.plan !== 'pro') {
      throw new HttpException('unknown_plan', HttpStatus.BAD_REQUEST);
    }
    return this.billingService.createCheckoutSession(req.user.userId, req.user.email, body.plan);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async portal(@Req() req: any) {
    return this.billingService.createPortalSession(req.user.userId);
  }

  /**
   * Stripe webhook — NO auth guard (Stripe can't send a JWT). Authenticity is
   * verified via the signature header against the raw request body.
   */
  @Post('webhook')
  async webhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) {
      throw new HttpException('raw_body_unavailable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return this.billingService.handleWebhook(req.rawBody, signature);
  }
}
