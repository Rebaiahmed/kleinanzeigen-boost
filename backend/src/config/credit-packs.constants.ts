/**
 * Single source of truth for purchasable credit packs. Stripe Checkout
 * Sessions are created with inline `price_data` (not pre-created Stripe
 * Price objects), so changing a value here is the ONLY step needed to
 * change pricing — no Stripe Dashboard sync required.
 *
 * priceEurCents is an integer (Stripe's native unit_amount) to avoid float
 * rounding bugs with EUR amounts.
 */
export const CREDIT_PACKS = {
  pack_100: { credits: 100, priceEurCents: 499 },
  pack_500: { credits: 500, priceEurCents: 1999 },
  pack_2000: { credits: 2000, priceEurCents: 6999 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function getCreditPack(packId: string) {
  return CREDIT_PACKS[packId as CreditPackId];
}
