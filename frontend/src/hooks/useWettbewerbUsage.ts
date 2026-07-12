import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

interface WettbewerbUsage {
  freeSearchUsed: boolean;
  savedSearchCount: number;
  freeLimit: number;
  additionalCost: number;
  hasSeenWettbewerb: boolean;
}

const DEFAULT_USAGE: WettbewerbUsage = {
  freeSearchUsed: false,
  savedSearchCount: 0,
  freeLimit: 1,
  additionalCost: 5,
  hasSeenWettbewerb: false,
};

async function fetchWettbewerbUsage(): Promise<WettbewerbUsage> {
  const res = await fetch(`${API_URL}/wettbewerb/usage`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return DEFAULT_USAGE;
  return res.json();
}

/**
 * Single shared query for both the usage pill (Wettbewerb.tsx) and the
 * "NEU" tab badge (AppShell.tsx via useWettbewerbSeen) — one cached fetch,
 * no race between the two.
 *
 * `enabled` defaults to true for the Wettbewerb page itself, but AppShell
 * (which mounts on every authenticated page) passes the feature flag so
 * this query never fires at all while Wettbewerb is off — keeping the
 * flag-off guarantee real rather than "fires and gets a harmless 404".
 */
export function useWettbewerbUsage(enabled: boolean = true) {
  const queryClient = useQueryClient();

  // NOTE: neither `isLoading` nor `isFetching` reliably signals "is this
  // real data yet" here. `isLoading` reports false immediately once
  // placeholderData exists, before the real fetch even starts. `isFetching`
  // is false both before enabled flips true AND after a real fetch
  // completes — indistinguishable states. `isPlaceholderData` is the
  // correct primitive: true whenever the returned data is still the
  // placeholder (disabled OR in-flight), false only once real data has
  // arrived. Callers that must not act on stale/default data (e.g. the
  // guide-modal auto-open effect, which would otherwise reopen for a
  // returning user) should gate on `!isPlaceholderData`.
  const { data = DEFAULT_USAGE, isPlaceholderData } = useQuery({
    queryKey: ['wettbewerb-usage'],
    queryFn: fetchWettbewerbUsage,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    placeholderData: DEFAULT_USAGE,
    enabled,
  });

  const refetchUsage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wettbewerb-usage'] });
  }, [queryClient]);

  return { ...data, isPlaceholderData, refetchUsage };
}
