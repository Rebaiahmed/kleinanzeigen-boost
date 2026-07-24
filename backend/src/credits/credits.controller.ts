import { Controller, Get, Post, Body, UseGuards, Req, Res, RawBodyRequest, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { ReserveCreditsDto, ConfirmCreditsDto, CreateCheckoutDto } from './dto/credits.dto';
import { CreditActionType } from '../config/credit-costs.constants';
import { CREDIT_PACKS } from '../config/credit-packs.constants';
import { sendAdminAlert } from '../common/admin-alert.util';

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

  /** Public (no auth) — pricing info, not sensitive, same pattern as
   *  /api/config/feature-flags. Keeps credit-packs.constants.ts the single
   *  source of truth instead of duplicating prices in the frontend. */
  @Get('packs')
  async getPacks() {
    return { packs: CREDIT_PACKS };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reserve')
  async reserve(@Req() req: any, @Body() body: ReserveCreditsDto) {
    this.assertEnabled();
    return this.creditsService.reserve(req.user.userId, body.actionType as CreditActionType, body.relatedActionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirm(@Body() body: ConfirmCreditsDto) {
    this.assertEnabled();
    await this.creditsService.confirm(body.relatedActionId, body.success);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req: any, @Body() body: CreateCheckoutDto) {
    this.assertEnabled();
    return this.stripeService.createCheckoutSession(req.user.userId, body.packId);
  }

  /** Every mutating route (reserve/confirm/checkout) goes through this so the
   *  flag is a real backend guarantee, not just a client-side convention —
   *  extension code can call these unconditionally and they simply won't
   *  activate while the flag is off. getBalance handles the flag itself
   *  (returns {enabled:false} instead of throwing, since it's the read the
   *  popup uses to decide whether to render anything at all). */
  private assertEnabled() {
    if (!FEATURE_FLAGS.enableCredits) {
      throw new HttpException({ message: 'Credits sind nicht aktiviert.', code: 'CREDITS_DISABLED' }, HttpStatus.NOT_FOUND);
    }
  }

  // Stripe calls this directly — no JWT, verified via signature instead.
  // No @Body() DTO here on purpose: the global ValidationPipe only runs on
  // @Body()-bound DTO params, and we need the untouched raw buffer for
  // signature verification, not a JSON-parsed body.
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    if (!FEATURE_FLAGS.enableCredits) {
      res.status(404).json({ message: 'Credits sind nicht aktiviert.' });
      return;
    }
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
        await this.creditsService.grantFromStripeEvent(event.id, metadata, session.payment_intent || null);
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      // Observability only, deliberately not automated clawback/suspension —
      // see CreditsService.handleChargeRefundOrDispute's doc comment. Both
      // Stripe's Charge and Dispute event objects carry `payment_intent`.
      const eventObject = event.data.object as any;
      const paymentIntentId: string | null = eventObject.payment_intent || null;
      const kind = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
      const { userId } = await this.creditsService.handleChargeRefundOrDispute(paymentIntentId, kind, event.id);
      if (userId) {
        await sendAdminAlert(
          `💳 Stripe credit purchase ${kind} — userId=${userId}, paymentIntent=${paymentIntentId}. ` +
          `No automatic action taken (credits not clawed back); please review manually.`,
        );
      }
    }

    res.json({ received: true });
  }
}
