import { useState, useEffect } from 'react';
import { fetchFeatureFlags, getFeatureFlags, FeatureFlags } from '../config/feature-flags';

/**
 * Hook to access feature flags.
 * Fetches from backend on first mount, caches result.
 *
 * `isLoaded` starts false and flips true once the real flags have been
 * fetched — callers that redirect based on a flag (e.g. Wettbewerb.tsx's
 * flag-off Navigate) must wait for this, since `flags` itself starts at
 * all-false defaults before the fetch resolves; redirecting on that first
 * render would bounce a flag-ON user away before the real value loads.
 */
export function useFeatureFlags(): FeatureFlags & { isLoaded: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchFeatureFlags().then((freshFlags) => {
      setFlags(freshFlags);
      setIsLoaded(true);
    });
  }, []);

  return { ...flags, isLoaded };
}
