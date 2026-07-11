import { Controller, Get, Post, Body, UseGuards, Req, Res, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { ReserveCreditsDto, ConfirmCreditsDto, CreateCheckoutDto } from './dto/credits.dto';
import { CreditActionType } from '../config/credit-costs.constants';

@Controller('api/credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly stripeService: StripeService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('balance')
  async getBalance(@Req() req: any) {
    if (!FEATURE_FLAGS.enableCredits) {
      return { enabled: false };
    }
    await this.creditsService.ensureInitialized(req.user.userId);
    const balance = await this.creditsService.getBalance(req.user.userId);
    return { enabled: true, balance };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reserve')
  async reserve(@Req() req: any, @Body() body: ReserveCreditsDto) {
    return this.creditsService.reserve(req.user.userId, body.actionType as CreditActionType, body.relatedActionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirm(@Body() body: ConfirmCreditsDto) {
    await this.creditsService.confirm(body.relatedActionId, body.success);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req: any, @Body() body: CreateCheckoutDto) {
    return this.stripeService.createCheckoutSession(req.user.userId, body.packId);
  }

  // Stripe calls this directly — no JWT, verified via signature instead.
  // No @Body() DTO here on purpose: the global ValidationPipe only runs on
  // @Body()-bound DTO params, and we need the untouched raw buffer for
  // signature verification, not a JSON-parsed body.
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const signature = req.headers['stripe-signature'] as string;
    let event;
    try {
      event = this.stripeService.constructEvent(req.rawBody!, signature);
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const metadata = session.metadata as { userId: string; packId: string; credits: string };
      if (metadata?.userId && metadata?.credits) {
        await this.creditsService.grantFromStripeEvent(event.id, metadata);
      }
    }

    res.json({ received: true });
  }
}
