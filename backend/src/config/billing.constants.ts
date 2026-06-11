/**
 * Stripe billing configuration.
 *
 * Billing is a strict superset of monetization: it only activates when
 * MONETIZATION_ENABLED=true AND the Stripe keys/price IDs are present. Until
 * then every billing endpoint returns 503 `billing_disabled`, so the live free
 * app is completely unaffected.
 */
import { MONETIZATION_ENABLED } from './ai-limits.constants';

/** Paid plans that can be purchased via Stripe Checkout. */
export type PaidPlan = 'starter' | 'pro';

/** Map a plan key → its Stripe Price ID (recurring monthly). Set via env. */
export const STRIPE_PRICE_IDS: Record<PaidPlan, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
};

/** Reverse lookup: Stripe Price ID → plan tier (used in the webhook). */
export function planForPriceId(priceId?: string | null): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_IDS.starter) return 'starter';
  if (priceId === STRIPE_PRICE_IDS.pro) return 'pro';
  return null;
}

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/** Where Stripe redirects after checkout / portal. */
export const BILLING_SUCCESS_URL =
  process.env.BILLING_SUCCESS_URL || 'http://localhost:5173/einstellungen?checkout=success';
export const BILLING_CANCEL_URL =
  process.env.BILLING_CANCEL_URL || 'http://localhost:5173/einstellungen?checkout=cancel';

/**
 * True only when monetization is on and Stripe is fully configured.
 * Endpoints and UI both key off this single flag.
 */
export const BILLING_ENABLED =
  MONETIZATION_ENABLED &&
  !!STRIPE_SECRET_KEY &&
  !!STRIPE_PRICE_IDS.starter &&
  !!STRIPE_PRICE_IDS.pro;
