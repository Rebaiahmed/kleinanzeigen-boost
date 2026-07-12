/**
 * Shared config for the Wettbewerb (competitor tracker) tab.
 * Mirrored in frontend/src/config/wettbewerbConstants.ts — this repo has no
 * shared frontend/backend package, so keep both copies in sync manually
 * (same duplication pattern as FeatureFlags itself).
 */

// Kleinanzeigen's actual allowed search radii. Any other value must be
// rejected before it ever reaches a search URL.
export const RADIUS_OPTIONS_KM = [0, 5, 10, 20, 30, 50, 100, 150, 200] as const;
export const DEFAULT_RADIUS_KM = 30;

export const CHECK_INTERVAL_OPTIONS_DAYS = [1, 2, 7] as const;
export const DEFAULT_CHECK_INTERVAL_DAYS = 2;

export const FREE_SAVED_SEARCH_LIMIT = 1;
// TODO(credits-stripe): once feature/credits-stripe merges, add a
// `competitor_tracking: ADDITIONAL_SEARCH_CREDIT_COST` entry to
// CREDIT_COSTS on that branch and wire WettbewerbCreditsStub to the real
// CreditsService.reserve() using this cost.
export const ADDITIONAL_SEARCH_CREDIT_COST = 5;

export const MIN_KEYWORD_LENGTH = 3;

// Overly generic single-word search terms that should soft-warn (not block)
// even when they meet the length minimum. Judgment call — extend based on
// real search logs once shipped; false positives here are low-cost since
// this is only a warning, not a hard block.
export const GENERIC_KEYWORD_DENYLIST = [
  'sofa',
  'tisch',
  'stuhl',
  'schrank',
  'lampe',
  'fahrrad',
  'auto',
  'handy',
  'möbel',
  'moebel',
  'sachen',
  'sonstiges',
  'diverses',
  'kleidung',
  'spielzeug',
  'buch',
  'bücher',
  'buecher',
  'deko',
];
