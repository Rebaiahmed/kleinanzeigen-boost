import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

interface CreditPack {
  credits: number;
  priceEurCents: number;
}

async function fetchBalance(): Promise<{ enabled: boolean; balance?: number }> {
  try {
    const res = await fetch(`${API_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return { enabled: false };
    return res.json();
  } catch {
    return { enabled: false };
  }
}

async function fetchPacks(): Promise<Record<string, CreditPack>> {
  try {
    const res = await fetch(`${API_URL}/credits/packs`);
    if (!res.ok) return {};
    const json = await res.json();
    return json.packs || {};
  } catch {
    return {};
  }
}

export function useCredits() {
  const queryClient = useQueryClient();
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: balanceData } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: fetchBalance,
    staleTime: 1000 * 30,
    placeholderData: { enabled: false },
  });

  const { data: packs } = useQuery({
    queryKey: ['credits-packs'],
    queryFn: fetchPacks,
    staleTime: 1000 * 60 * 60,
    placeholderData: {},
  });

  const buyCredits = useCallback(async (packId: string) => {
    setBusyPackId(packId);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/credits/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ packId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setError(json?.message || 'Vorgang fehlgeschlagen. Bitte später erneut versuchen.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setBusyPackId(null);
    }
  }, []);

  const refetchBalance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
  }, [queryClient]);

  return {
    enabled: balanceData?.enabled === true,
    balance: balanceData?.balance ?? 0,
    packs: packs || {},
    busy: busyPackId !== null,
    busyPackId,
    error,
    buyCredits,
    refetchBalance,
  };
}
