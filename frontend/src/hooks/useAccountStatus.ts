import { useQuery } from '@tanstack/react-query';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

async function fetchAuthStatus() {
  const token = getToken();
  if (!token) return { kleinanzeigenAccountStatus: 'active' };
  const res = await fetch(`${API_URL}/auth/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { kleinanzeigenAccountStatus: 'active' };
  return res.json();
}

/**
 * Surfaces users/{id}.accountStatus — set to 'expired' by the scheduler once
 * it confirms the user's Kleinanzeigen session cookies stopped authenticating
 * (see backend scheduler.service.ts's confirmSessionExpired). Without this,
 * auto-repost silently stops with no UI indication (see
 * docs/SCHEDULED-REPOST-EDGE-CASES.md, Finding B). Polled rather than pushed
 * live so it's visible even on a fresh page load, not just while a tab was
 * open when the expiry was detected.
 */
export function useAccountStatus() {
  const { data } = useQuery({
    queryKey: ['auth-status'],
    queryFn: fetchAuthStatus,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
    placeholderData: { kleinanzeigenAccountStatus: 'active' },
  });

  return { kleinanzeigenSessionExpired: data?.kleinanzeigenAccountStatus === 'expired' };
}
