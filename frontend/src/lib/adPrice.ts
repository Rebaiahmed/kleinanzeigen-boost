/**
 * Ad price-type helpers.
 *
 * The ad data has no explicit priceType field, so give-away ("Zu verschenken")
 * is derived from the price label that Kleinanzeigen returns (an HTML string).
 * For give-away ads a price suggestion is logically void — there's nothing to
 * price — so callers use this to hide the price-suggestion affordance.
 */
export function isGiveAwayAd(ad: { price?: unknown } | null | undefined): boolean {
  const text = String(ad?.price ?? '').replace(/<[^>]*>/g, '').toLowerCase();
  return text.includes('verschenken');
}
