import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import { FirebaseService } from '../firebase/firebase.service';
import { sendAdminAlert } from '../common/admin-alert.util';
import {
  PaidPlan,
  STRIPE_PRICE_IDS,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  BILLING_SUCCESS_URL,
  BILLING_CANCEL_URL,
  BILLING_ENABLED,
  planForPriceId,
} from '../config/billing.constants';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly firebaseService: FirebaseService) {
    if (STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
    }
  }

  /** Guard used by every public method — fails clearly when billing is off. */
  private assertEnabled(): Stripe {
    if (!BILLING_ENABLED || !this.stripe) {
      throw new HttpException('billing_disabled', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return this.stripe;
  }

  isEnabled(): boolean {
    return BILLING_ENABLED;
  }

  /** Get or create the Stripe customer for a user, persisting the id. */
  private async getOrCreateCustomer(userId: string, email?: string): Promise<string> {
    const stripe = this.assertEnabled();
    const db = this.firebaseService.firestore;
    const userRef = db.collection('users').doc(userId);
    const snap = await userRef.get();
    const existing = snap.data()?.stripeCustomerId;
    if (existing) return existing;

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
    return customer.id;
  }

  /** Create a Checkout Session for a paid plan; returns the redirect URL. */
  async createCheckoutSession(userId: string, email: string | undefined, plan: PaidPlan): Promise<{ url: string }> {
    const stripe = this.assertEnabled();
    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) throw new HttpException('unknown_plan', HttpStatus.BAD_REQUEST);

    const customerId = await this.getOrCreateCustomer(userId, email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: BILLING_SUCCESS_URL,
      cancel_url: BILLING_CANCEL_URL,
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId, plan } },
      metadata: { userId, plan },
    });
    if (!session.url) throw new HttpException('checkout_failed', HttpStatus.INTERNAL_SERVER_ERROR);
    return { url: session.url };
  }

  /** Create a Customer Portal session so the user can manage/cancel. */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.assertEnabled();
    const db = this.firebaseService.firestore;
    const customerId = (await db.collection('users').doc(userId).get()).data()?.stripeCustomerId;
    if (!customerId) throw new HttpException('no_customer', HttpStatus.BAD_REQUEST);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: BILLING_SUCCESS_URL,
    });
    return { url: session.url };
  }

  /**
   * Verify + handle a Stripe webhook. Maps subscription lifecycle → users/{id}.tier.
   * Idempotent: we always derive tier from the current subscription state.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const stripe = this.assertEnabled();
    if (!STRIPE_WEBHOOK_SECRET) {
      throw new HttpException('webhook_not_configured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      this.logger.warn(`[Billing] webhook signature verification failed: ${err.message}`);
      throw new HttpException('invalid_signature', HttpStatus.BAD_REQUEST);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.syncFromSubscription(session.customer as string, session.subscription as string, event.created);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const sub = event.data.object as Stripe.Subscription;
          await this.applySubscription(sub.customer as string, sub, event.created);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await this.downgradeToFree(sub.customer as string, event.created);
          break;
        }
        case 'charge.refunded':
        case 'charge.dispute.created': {
          // Observability only, deliberately not an automatic downgrade —
          // see docs/FEATURE-EDGE-CASES.md, Area 2 #3. Stripe already sends
          // its own customer.subscription.updated/deleted events through the
          // normal dunning/cancellation flow; reacting to a raw refund or
          // dispute here too could downgrade a subscriber before the actual
          // outcome (which may resolve in their favor) is known. This just
          // gets a human in the loop.
          const eventObject = event.data.object as any;
          const customerId: string | undefined = eventObject.customer;
          if (customerId) {
            const kind = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
            await this.recordChargeAlert(customerId, kind, event.id);
          }
          break;
        }
        default:
          // Ignore the long tail of events we don't act on.
          break;
      }
    } catch (err: any) {
      this.logger.error(`[Billing] error handling ${event.type}: ${err.message}`);
      // Swallow so Stripe doesn't retry forever on a non-retryable bug; logged above.
    }

    return { received: true };
  }

  private async syncFromSubscription(customerId: string, subscriptionId: string, eventCreated: number) {
    const stripe = this.assertEnabled();
    if (!subscriptionId) return;
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    await this.applySubscription(customerId, sub, eventCreated);
  }

  /** Derive tier from a subscription's active price and persist it. */
  private async applySubscription(customerId: string, sub: Stripe.Subscription, eventCreated: number) {
    const priceId = sub.items.data[0]?.price?.id;
    const plan = planForPriceId(priceId);
    const active = ['active', 'trialing', 'past_due'].includes(sub.status);

    if (active && plan) {
      const applied = await this.applyIfNewer(customerId, eventCreated, {
        tier: plan, subscriptionStatus: sub.status, stripeSubscriptionId: sub.id,
      });
      if (applied) this.logger.log(`[Billing] customer ${customerId} → tier=${plan} (${sub.status})`);
    } else {
      await this.downgradeToFree(customerId, eventCreated);
    }
  }

  private async downgradeToFree(customerId: string, eventCreated: number) {
    const applied = await this.applyIfNewer(customerId, eventCreated, {
      tier: 'free', subscriptionStatus: 'canceled',
    });
    if (applied) this.logger.log(`[Billing] customer ${customerId} → tier=free`);
  }

  /**
   * Stripe does not guarantee webhook delivery order, and this app has no
   * event-ID dedup table for billing (unlike credits' stripeWebhookEvents —
   * subscription state updates are naturally idempotent replay-wise since
   * they always write the CURRENT derived tier rather than incrementing
   * anything). Ordering is the separate risk that idempotency alone doesn't
   * cover: a delayed customer.subscription.deleted arriving after a newer
   * customer.subscription.updated could downgrade a user who has since
   * resubscribed. Each Stripe Event carries its own `created` (Unix
   * seconds) timestamp — stored per-customer as lastBillingEventAt inside
   * the SAME transaction as the tier write, so a race between two
   * concurrent webhook deliveries can't both pass the "is this newer" check
   * before either commits. Returns whether the mutation was actually
   * applied (false = skipped as stale/out-of-order), purely for logging.
   */
  private async applyIfNewer(
    customerId: string,
    eventCreated: number,
    fields: Record<string, any>,
  ): Promise<boolean> {
    const db = this.firebaseService.firestore;
    const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (q.empty) {
      this.logger.warn(`[Billing] no user found for customer ${customerId}`);
      return false;
    }
    const userRef = q.docs[0].ref;

    return db.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      const lastEventAt = doc.data()?.lastBillingEventAt ?? 0;
      if (eventCreated <= lastEventAt) {
        this.logger.warn(
          `[Billing] skipping stale/out-of-order event for customer ${customerId} ` +
          `(event created=${eventCreated}, already applied up to ${lastEventAt})`,
        );
        return false;
      }
      t.set(userRef, { ...fields, lastBillingEventAt: eventCreated }, { merge: true });
      return true;
    });
  }

  /** Logs a refund/dispute against the affected subscriber + alerts an
   *  admin to review manually. See the call site's comment for why this
   *  doesn't take automatic action on the subscription itself. */
  private async recordChargeAlert(customerId: string, kind: 'refunded' | 'disputed', stripeEventId: string) {
    const userRef = await this.userRefForCustomer(customerId);
    if (!userRef) return;
    await userRef.collection('billingAlerts').add({
      kind, customerId, stripeEventId, createdAt: new Date().toISOString(), reviewed: false,
    });
    await sendAdminAlert(
      `💳 Stripe subscription charge ${kind} — customerId=${customerId}, user=${userRef.id}. ` +
      `No automatic downgrade taken; please review manually.`,
    );
  }

  /** Find the user document for a Stripe customer id. */
  private async userRefForCustomer(customerId: string) {
    const db = this.firebaseService.firestore;
    const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    return q.empty ? null : q.docs[0].ref;
  }
}
