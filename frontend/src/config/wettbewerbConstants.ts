/**
 * Shared config for the Wettbewerb (competitor tracker) tab.
 * Keep in sync with backend/src/config/wettbewerb.constants.ts — this repo
 * has no shared frontend/backend package, so this is a manual mirror (same
 * duplication pattern as FeatureFlags itself).
 */

export const RADIUS_OPTIONS_KM = [0, 5, 10, 20, 30, 50, 100, 150, 200] as const;
export const DEFAULT_RADIUS_KM = 30;

export const CHECK_INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Täglich' },
  { value: 2, label: 'Alle 2 Tage' },
  { value: 7, label: 'Wöchentlich' },
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
