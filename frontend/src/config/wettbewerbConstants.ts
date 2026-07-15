/**
 * Shared config for the Wettbewerb (competitor tracker) tab.
 * Keep in sync with backend/src/config/wettbewerb.constants.ts — this repo
 * has no shared frontend/backend package, so this is a manual mirror (same
 * duplication pattern as FeatureFlags itself).
 */

export const RADIUS_OPTIONS_KM = [0, 5, 10, 20, 30, 50, 100, 150, 200] as const;
export const DEFAULT_RADIUS_KM = 30;

// labelKey resolves via i18next (t(labelKey)) — kept as a key, not a
// hardcoded string, so this shared constants file doesn't need to pick a
// display language itself.
export const CHECK_INTERVAL_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 1, labelKey: 'wettbewerb.intervalDaily' },
  { value: 2, labelKey: 'wettbewerb.intervalEvery2Days' },
  { value: 7, labelKey: 'wettbewerb.intervalWeekly' },
];
export const DEFAULT_CHECK_INTERVAL_DAYS = 2;

export const FREE_SAVED_SEARCH_LIMIT = 1;
export const ADDITIONAL_SEARCH_CREDIT_COST = 5;

export const MIN_KEYWORD_LENGTH = 3;

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
