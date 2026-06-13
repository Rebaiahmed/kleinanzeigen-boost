import { useState, useEffect } from 'react';
import { fetchFeatureFlags, getFeatureFlags, FeatureFlags } from '../config/feature-flags';

/**
 * Hook to access feature flags.
 * Fetches from backend on first mount, caches result.
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags());

  useEffect(() => {
    fetchFeatureFlags().then((freshFlags) => {
      setFlags(freshFlags);
    });
  }, []);

  return flags;
}
