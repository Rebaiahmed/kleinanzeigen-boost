import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

function handleUnauthorized() {
  localStorage.removeItem('kb_session');
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export interface CreateSavedSearchInput {
  keyword: string;
  plz: string;
  radiusKm: number;
  checkIntervalDays: number;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  code?: string;
}

export function useWettbewerbActions() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wettbewerb-searches'] });
    queryClient.invalidateQueries({ queryKey: ['wettbewerb-usage'] });
  }, [queryClient]);

  const createSavedSearch = useCallback(
    async (input: CreateSavedSearchInput): Promise<ActionResult> => {
      setIsCreating(true);
      try {
        const res = await fetch(`${API_URL}/wettbewerb/searches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(input),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return { success: false };
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          invalidateAll();
          return { success: true };
        }
        // TODO(credits-stripe): once the real credits system lands, this 501
        // CREDITS_NOT_AVAILABLE path will succeed instead — no special-casing
        // needed here, the message already comes from the backend either way.
        return { success: false, message: data.message || 'Suche konnte nicht gespeichert werden.', code: data.code };
      } catch {
        return { success: false, message: 'Netzwerkfehler beim Speichern der Suche.' };
      } finally {
        setIsCreating(false);
      }
    },
    [invalidateAll],
  );

  const deleteSavedSearch = useCallback(
    async (searchId: string): Promise<ActionResult> => {
      try {
        const res = await fetch(`${API_URL}/wettbewerb/searches/${searchId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) {
          handleUnauthorized();
          return { success: false };
        }
        if (res.ok) {
          invalidateAll();
          return { success: true };
        }
        return { success: false, message: 'Suche konnte nicht gelöscht werden.' };
      } catch {
        return { success: false, message: 'Netzwerkfehler beim Löschen der Suche.' };
      }
    },
    [invalidateAll],
  );

  const applySuggestedPrice = useCallback(
    async (searchId: string, adId: string): Promise<ActionResult> => {
      try {
        const res = await fetch(`${API_URL}/wettbewerb/searches/${searchId}/apply-price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ adId }),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return { success: false };
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['ads'] });
          return { success: true };
        }
        return { success: false, message: data.message || 'Preis konnte nicht übernommen werden.' };
      } catch {
        return { success: false, message: 'Netzwerkfehler beim Übernehmen des Preises.' };
      }
    },
    [queryClient],
  );

  const triggerRepost = useCallback(
    async (searchId: string, adId: string): Promise<ActionResult> => {
      try {
        const res = await fetch(`${API_URL}/wettbewerb/searches/${searchId}/repost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ adId }),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return { success: false };
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['ads'] });
          return { success: true };
        }
        return { success: false, message: data.message || 'Repost fehlgeschlagen.' };
      } catch {
        return { success: false, message: 'Netzwerkfehler beim Repost.' };
      }
    },
    [queryClient],
  );

  const markGuideSeen = useCallback(async (): Promise<void> => {
    try {
      await fetch(`${API_URL}/wettbewerb/guide-seen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      queryClient.invalidateQueries({ queryKey: ['wettbewerb-usage'] });
    } catch {
      // Non-critical — worst case the guide/badge reappears once more.
    }
  }, [queryClient]);

  return { createSavedSearch, deleteSavedSearch, applySuggestedPrice, triggerRepost, markGuideSeen, isCreating };
}
