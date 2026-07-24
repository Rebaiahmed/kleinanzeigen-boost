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
  pack_50: { credits: 50, priceEurCents: 299 },
  pack_200: { credits: 200, priceEurCents: 799 },
  pack_500: { credits: 500, priceEurCents: 1499 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function getCreditPack(packId: string) {
  return CREDIT_PACKS[packId as CreditPackId];
}
