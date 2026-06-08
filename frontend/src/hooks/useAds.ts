import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
const TIMEOUT_MS = 10_000;

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

async function fetchAdsFromServer(): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/ads`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    });
    if (res.status === 401) {
      localStorage.removeItem('kb_session');
      localStorage.removeItem('token');
      window.location.href = '/auth';
      return [];
    }
    const data = await res.json();
    return data.ads || [];
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Zeitüberschreitung — bitte erneut versuchen.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function useAds() {
  const queryClient = useQueryClient();

  const { data: ads = [], isLoading, isFetching, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['ads'],
    queryFn: fetchAdsFromServer,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 2000,
  });

  const invalidateAds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ads'] });
  }, [queryClient]);

  const updateAdInCache = useCallback((adId: string, fields: Partial<any>) => {
    queryClient.setQueryData(['ads'], (old: any[] = []) =>
      old.map(ad => ad.id === adId ? { ...ad, ...fields } : ad)
    );
  }, [queryClient]);

  return { ads, isLoading, isFetching, isError, error, dataUpdatedAt, invalidateAds, updateAdInCache };
}
