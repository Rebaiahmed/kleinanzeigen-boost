import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

async function fetchAdsFromServer(): Promise<any[]> {
  const res = await fetch(`${API_URL}/ads`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 401) {
    localStorage.removeItem('kb_session');
    localStorage.removeItem('token');
    window.location.href = '/auth';
    return [];
  }
  const data = await res.json();
  return data.ads || [];
}

export function useAds() {
  const queryClient = useQueryClient();

  const { data: ads = [], isLoading, isFetching } = useQuery({
    queryKey: ['ads'],
    queryFn: fetchAdsFromServer,
    // Keep previous data visible while refetching (no empty flash on refresh)
    placeholderData: (prev) => prev,
  });

  // Call this after a sync to refresh the cache
  const invalidateAds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ads'] });
  }, [queryClient]);

  // Optimistically update a single ad in the cache
  const updateAdInCache = useCallback((adId: string, fields: Partial<any>) => {
    queryClient.setQueryData(['ads'], (old: any[] = []) =>
      old.map(ad => ad.id === adId ? { ...ad, ...fields } : ad)
    );
  }, [queryClient]);

  return { ads, isLoading, isFetching, invalidateAds, updateAdInCache };
}
