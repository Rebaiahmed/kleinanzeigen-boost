import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
const TIMEOUT_MS = 10_000;

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

/**
 * DEV-ONLY mock: in a development build (`npm run dev`), set
 * `localStorage.ab_mock_ads = '100'` and reload to render N synthetic ads so you
 * can eyeball pagination / search / list performance without a big real account.
 * Gated on import.meta.env.DEV, so this whole branch is dead-code-eliminated from
 * production builds and can never affect the live dashboard.
 */
function devMockAds(): any[] | null {
  if (!(import.meta as any).env.DEV) return null;
  const n = parseInt(localStorage.getItem('ab_mock_ads') || '', 10);
  if (!n || n < 1) return null;
  const titles = ['Sessel', 'iPhone 13', 'Bücherregal', 'Umzugskartons', 'Fahrrad', 'Sofa', 'Tisch', 'Lampe'];
  return Array.from({ length: n }, (_, i) => ({
    id: `mock-${i + 1}`,
    title: `${titles[i % titles.length]} #${i + 1}`,
    price: `${(i % 9) * 10 + 5} €`,
    views: (i * 7) % 120,
    listingState: 'active',
    firstSyncedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    adImage: { url: '' },
  }));
}

async function fetchAdsFromServer(): Promise<any[]> {
  const mock = devMockAds();
  if (mock) return mock;

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
      window.location.href = '/login';
      return [];
    }
    const data = await res.json();
    return data.ads || [];
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Zeitüberschreitung — bitte erneut versuchen.');
    if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
      throw new Error('Service momentan nicht verfügbar. Bitte versuche es in Kürze erneut.');
    }
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
