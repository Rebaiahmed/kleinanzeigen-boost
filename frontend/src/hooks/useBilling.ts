import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

async function fetchBillingStatus(): Promise<{ enabled: boolean }> {
  try {
    const res = await fetch(`${API_URL}/billing/status`);
    if (!res.ok) return { enabled: false };
    return res.json();
  } catch {
    return { enabled: false };
  }
}

export type PaidPlan = 'starter' | 'pro';

/**
 * Billing actions + status. When billing is disabled (default), `enabled` is
 * false and the UI hides all upgrade/manage controls — the app stays free.
 */
export function useBilling() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: fetchBillingStatus,
    staleTime: 1000 * 60 * 5,
    placeholderData: { enabled: false },
  });

  const redirect = useCallback(async (path: string, body?: any) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setError(json?.message || 'Vorgang fehlgeschlagen. Bitte später erneut versuchen.');
        return;
      }
      window.location.href = json.url; // Stripe-hosted checkout / portal
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setBusy(false);
    }
  }, []);

  const startCheckout = useCallback((plan: PaidPlan) => redirect('checkout', { plan }), [redirect]);
  const openPortal = useCallback(() => redirect('portal'), [redirect]);

  return { enabled: data?.enabled === true, busy, error, startCheckout, openPortal };
}
