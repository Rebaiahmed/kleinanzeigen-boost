import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import { CreditPackId, getCreditPack } from '../config/credit-packs.constants';

/** Thin Stripe SDK wrapper. Kept separate from CreditsService so the core
 *  wallet logic stays Stripe-agnostic and testable without a Stripe key. */
@Injectable()
export class StripeService {
  private get stripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new HttpException('Stripe ist nicht konfiguriert.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return new Stripe(key);
  }

  async createCheckoutSession(userId: string, packId: string): Promise<{ url: string }> {
    const pack = getCreditPack(packId);
    if (!pack) {
      throw new HttpException('Unbekanntes Credit-Paket.', HttpStatus.BAD_REQUEST);
    }
    const frontendUrl = process.env.FRONTEND_URL || 'https://anzeigenboost.de';
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: pack.priceEurCents,
            product_data: { name: `${pack.credits} Credits — AnzeigenBoost` },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, packId: packId as CreditPackId, credits: String(pack.credits) },
      success_url: `${frontendUrl}/einstellungen?credits=success`,
      cancel_url: `${frontendUrl}/einstellungen?credits=cancel`,
    });
    if (!session.url) {
      throw new HttpException('Stripe Checkout Session konnte nicht erstellt werden.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return { url: session.url };
  }

  /** Throws if the signature doesn't verify — caller must catch and return 400. */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpException('Stripe Webhook ist nicht konfiguriert.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
