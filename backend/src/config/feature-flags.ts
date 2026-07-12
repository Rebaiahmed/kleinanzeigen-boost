/**
 * Central feature flag system. Readable on both frontend and backend.
 * All integration flags default to false (hidden until ready).
 *
 * Environment variables override defaults (e.g., ENABLE_EBAY=true)
 */

export interface FeatureFlags {
  enableVinted: boolean;
  enableEbay: boolean;
  enableFacebookMarketplace: boolean;
  enableAnalytics: boolean;
  enablePhotoFeedback: boolean;
  enablePriceSuggestion: boolean;
  enableDisclaimer: boolean;
  enableWettbewerb: boolean;
  enableCredits: boolean;
  enableI18n: boolean;
}

function parseEnvBool(value: string | undefined, defaultVal: boolean): boolean {
  if (value === undefined) return defaultVal;
  return value.toLowerCase() === 'true' || value === '1';
}

export const FEATURE_FLAGS: FeatureFlags = {
  // Marketplace integrations — default OFF until ready
  enableVinted: parseEnvBool(process.env.ENABLE_VINTED, false),
  enableEbay: parseEnvBool(process.env.ENABLE_EBAY, false),
  enableFacebookMarketplace: parseEnvBool(process.env.ENABLE_FACEBOOK_MARKETPLACE, false),
  // Per-repost analytics — default OFF until UI is finalized
  enableAnalytics: parseEnvBool(process.env.ENABLE_ANALYTICS, false),
  // Photo quality feedback — default OFF until ready
  enablePhotoFeedback: parseEnvBool(process.env.ENABLE_PHOTO_FEEDBACK, false),
  // Price suggestion — default ON (Preis button on priced ads; the AdCard already
  // hides it for "Zu verschenken" give-aways). Set ENABLE_PRICE_SUGGESTION=false to disable.
  enablePriceSuggestion: parseEnvBool(process.env.ENABLE_PRICE_SUGGESTION, true),
  // Legal disclaimer insert (Gewährleistungsausschluss) — default OFF. The
  // shipped text is a PLACEHOLDER until a qualified legal source verifies it —
  // see frontend/src/config/legalDisclaimer.ts. Do not enable in production
  // before that's replaced.
  enableDisclaimer: parseEnvBool(process.env.FEATURE_DISCLAIMER_ENABLED, false),
  // Wettbewerb (competitor tracker) tab — default OFF until verified end-to-end.
  // Credit-check calls go through WettbewerbCreditsStub — see
  // backend/src/wettbewerb/wettbewerb-credits.stub.ts for the TODO to swap it
  // for the real CreditsService now that credits-stripe is merged.
  enableWettbewerb: parseEnvBool(process.env.FEATURE_WETTBEWERB_ENABLED, false),
  // Pay-as-you-go credits wallet (Stripe one-time purchases) — default OFF until
  // verified end-to-end. Independent of MONETIZATION_ENABLED (backend/src/config/
  // ai-limits.constants.ts), which gates the older monthly-quota tier system —
  // the two are orthogonal and BOTH apply to AI generation when both are on
  // (quota checked first, cheap; credits deducted second, only if quota passes).
  // Flipping this on while MONETIZATION_ENABLED stays off is a valid soft-launch
  // state (unlimited monthly quota, but credits still meter/charge per action).
  enableCredits: parseEnvBool(process.env.ENABLE_CREDITS, false),
  // EN/DE i18n toggle — default OFF until translations are reviewed and the
  // toggle is verified end-to-end on both dashboard and extension popup.
  // German remains the always-available default language regardless of this
  // flag; this only gates whether the DE|EN toggle UI is rendered at all.
  enableI18n: parseEnvBool(process.env.FEATURE_I18N_ENABLED, false),
};

/**
 * Serialize flags for frontend consumption.
 * Called by API endpoint that frontend polls at startup.
 */
export function getFeatureFlagsForClient(): FeatureFlags {
  return { ...FEATURE_FLAGS };
}
