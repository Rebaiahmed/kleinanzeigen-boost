import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

export interface WettbewerbSnapshot {
  checkedAt: string;
  totalResultsFound: number;
  userAdRank: number | null;
  userAdId: string | null;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  suggestedPriceLow: number | null;
  suggestedPriceHigh: number | null;
  topCompetitors: Array<{ rank: number; title: string; priceEUR: number | null; adId: string; isOwn: boolean }>;
}

export interface WettbewerbSearch {
  id: string;
  keyword: string;
  plz: string;
  radiusKm: number;
  checkIntervalDays: number;
  createdAt: string;
  updatedAt: string;
  isFree: boolean;
  status: 'active' | 'paused' | 'error';
  nextCheckAt: string | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  latestSnapshot: WettbewerbSnapshot | null;
}

async function fetchSavedSearches(): Promise<WettbewerbSearch[]> {
  const res = await fetch(`${API_URL}/wettbewerb/searches`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 401) {
    localStorage.removeItem('kb_session');
    localStorage.removeItem('token');
    window.location.href = '/login';
    return [];
  }
  if (!res.ok) return [];
  const data = await res.json();
  return data.searches || [];
}

export function useWettbewerbSearches(enabled: boolean = true) {
  const queryClient = useQueryClient();

  const { data: searches = [], isLoading, isError, error } = useQuery({
    queryKey: ['wettbewerb-searches'],
    queryFn: fetchSavedSearches,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 2000,
    enabled,
  });

  const invalidateSearches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wettbewerb-searches'] });
  }, [queryClient]);

  return { searches, isLoading, isError, error, invalidateSearches };
}
