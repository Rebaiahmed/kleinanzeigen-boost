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

  const { data = DEFAULT_USAGE, isLoading } = useQuery({
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

  return { ...data, isLoading, refetchUsage };
}
