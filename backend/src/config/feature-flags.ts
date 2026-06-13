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
};

/**
 * Serialize flags for frontend consumption.
 * Called by API endpoint that frontend polls at startup.
 */
export function getFeatureFlagsForClient(): FeatureFlags {
  return { ...FEATURE_FLAGS };
}
