/**
 * Frontend feature flags.
 * Fetched from backend at app startup.
 * Defaults are safe (all integrations hidden).
 */

export interface FeatureFlags {
  enableVinted: boolean;
  enableEbay: boolean;
  enableFacebookMarketplace: boolean;
}

const DEFAULTS: FeatureFlags = {
  enableVinted: false,
  enableEbay: false,
  enableFacebookMarketplace: false,
};

let cachedFlags: FeatureFlags = DEFAULTS;

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  try {
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    const res = await fetch(`${apiBase}/config/feature-flags`);
    if (res.ok) {
      cachedFlags = await res.json();
      return cachedFlags;
    }
  } catch (e) {
    console.warn('[FeatureFlags] Failed to fetch, using defaults:', e);
  }
  return DEFAULTS;
}

export function getFeatureFlags(): FeatureFlags {
  return { ...cachedFlags };
}
