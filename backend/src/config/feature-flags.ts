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
};

/**
 * Serialize flags for frontend consumption.
 * Called by API endpoint that frontend polls at startup.
 */
export function getFeatureFlagsForClient(): FeatureFlags {
  return { ...FEATURE_FLAGS };
}
