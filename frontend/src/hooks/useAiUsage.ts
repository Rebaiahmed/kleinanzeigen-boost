import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

async function fetchAiUsage() {
  const res = await fetch(`${API_URL}/ai/usage`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return { plan: 'free', callsCount: 0, limit: 50 };
  return res.json();
}

export function useAiUsage() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: fetchAiUsage,
    staleTime: 1000 * 60,      // cache 1 min — don't re-fetch on every render
    gcTime: 1000 * 60 * 10,
    placeholderData: { plan: 'free', callsCount: 0, limit: 50 },
  });

  const callsCount = data?.callsCount ?? 0;
  // unlimited = monetization disabled or an unlimited (pro) plan → no caps/warnings/blocks.
  const unlimited = data?.unlimited === true || data?.limit == null;
  const limit = unlimited ? Infinity : (data?.limit ?? 50);
  const remaining = unlimited ? Infinity : Math.max(0, limit - callsCount);
  const pct = unlimited ? 0 : (limit > 0 ? Math.round((callsCount / limit) * 100) : 0);
  const isWarning = !unlimited && pct >= 80 && pct < 100;   // ≥ 80% → yellow
  const isBlocked = !unlimited && callsCount >= limit;       // 100% → blocked

  // Call after each successful optimization to update cache immediately
  const incrementUsage = useCallback(() => {
    queryClient.setQueryData(['ai-usage'], (old: any) => ({
      ...old,
      callsCount: (old?.callsCount ?? 0) + 1,
    }));
  }, [queryClient]);

  const refetchUsage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
  }, [queryClient]);

  return { callsCount, limit, remaining, pct, isWarning, isBlocked, unlimited, incrementUsage, refetchUsage };
}
