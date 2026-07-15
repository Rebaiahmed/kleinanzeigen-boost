/**
 * Single source of truth for how many credits each action costs.
 * Deliberately generic — a new feature (e.g. competitor tracking) just adds
 * a key here and calls CreditsService.deduct/reserve with it. Never hardcode
 * a credit amount at a call site; always go through getCreditCost().
 */
export const CREDIT_COSTS = {
  repost: 1,
  smart_repost: 2,
  ai_generation: 2,
  competitor_tracking: 5,
} as const;

export type CreditActionType = keyof typeof CREDIT_COSTS;

export function getCreditCost(action: CreditActionType): number {
  return CREDIT_COSTS[action];
}
