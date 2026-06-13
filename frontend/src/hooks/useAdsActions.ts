import { useState, useCallback } from 'react';
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

export type ToastType = 'success' | 'error' | null;

export interface AdsActionsReturn {
  fetchAds: () => Promise<any[] | undefined>;
  syncAds: (setAds: React.Dispatch<React.SetStateAction<any[]>>) => Promise<void>;
  handleAction: (
    action: string,
    adId: string,
    successMsg: string,
    onSuccess: () => void,
  ) => Promise<void>;
  handleAIOptimize: (adId: string) => Promise<void>;
  handlePriceCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
  handleVintedCrossPost: (adId: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  handleEbayCrossPost: (adId: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  saveDraft: (adData: any) => Promise<any>;
  optimizeExistingAd: (title: string, description: string, category: string, price: string | number) => Promise<any>;
  updateAdFields: (adId: string, fields: { title?: string; description?: string; status?: string; repostIntervalMinutes?: number; nextRepostAt?: string; autoRepost?: boolean }) => Promise<boolean>;
  fetchSchedulerStatus: () => Promise<string | null>;
  isSyncing: boolean;
  toastMessage: string | null;
  toastType: ToastType;
  clearToast: () => void;
}

export function useAdsActions(): AdsActionsReturn {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, 3000);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
    setToastType(null);
  }, []);

  const fetchAds = useCallback(async (): Promise<any[] | undefined> => {
    try {
      const res = await fetch(`${API_URL}/ads`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await res.json();
      if (data.success) {
        return data.ads || [];
      }
    } catch (e: any) {
      if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
        showToast('Service momentan nicht verfügbar. Bitte versuche es in Kürze erneut.', 'error');
      } else {
        console.error('Failed to fetch ads', e);
      }
    }
    return undefined;
  }, [showToast]);

  const fetchSchedulerStatus = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/ads/scheduler-status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.lastRunAt || null;
      }
    } catch (e) {
      // fail silently
    }
    return null;
  }, []);

  const syncAds = useCallback(
    async (setAds: React.Dispatch<React.SetStateAction<any[]>>) => {
      setIsSyncing(true);

      // 1. Show cached ads immediately while sync runs
      try {
        const localRes = await fetch(`${API_URL}/ads`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (localRes.ok) {
          const localData = await localRes.json();
          if (localData.success && localData.ads?.length > 0) setAds(localData.ads);
        }
      } catch (e) {
        console.warn('Failed to load cached ads:', e);
      }

      // 2. Ensure extension has the token (in case session storage was cleared)
      const currentToken = getToken();
      if (currentToken) {
        window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token: currentToken }, '*');
        await new Promise(r => setTimeout(r, 200));
      }

      // 3. Try extension-initiated sync via content script relay (no extId needed)
      try {
        const result = await Promise.race<any>([
          new Promise<any>((resolve) => {
            const handler = (event: MessageEvent) => {
              if (event.data?.type === 'TRIGGER_SYNC_RESPONSE') {
                window.removeEventListener('message', handler);
                resolve(event.data);
              }
            };
            window.addEventListener('message', handler);
            window.postMessage({ type: 'TRIGGER_SYNC_REQUEST' }, '*');
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Extension sync timed out')), 10000)
          ),
        ]);

        console.log('[Sync] Extension result:', result);
        if (result.success && result.ads) {
          setAds(result.ads);
          queryClient.setQueryData(['ads'], result.ads);
          showToast('Anzeigen wurden erfolgreich synchronisiert', 'success');
          setIsSyncing(false);
          return;
        }
        console.warn('[Sync] Extension sync failed:', result.error);
      } catch (e: any) {
        console.warn('[Sync] Extension sync error:', e.message);
      }

      // 3. Fallback: server-side sync with 10s timeout
      try {
        const controller = new AbortController();
        const syncTimer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${API_URL}/ads/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        }).finally(() => clearTimeout(syncTimer));
        if (res.status === 401) { handleUnauthorized(); return; }
        const data = await res.json();
        if (data.success) {
          setAds(data.ads || []);
          showToast(
            data.extensionConnected
              ? 'Anzeigen wurden erfolgreich synchronisiert'
              : 'Gespeicherte Anzeigen geladen (Extension offline)',
            data.extensionConnected ? 'success' : 'error'
          );
        } else {
          showToast(data.message || 'Fehler beim Synchronisieren', 'error');
        }
      } catch (e: any) {
        showToast('Backend nicht erreichbar', 'error');
      } finally {
        setIsSyncing(false);
      }
    },
    [showToast],
  );

  const handleAction = useCallback(
    async (
      action: string,
      adId: string,
      successMsg: string,
      onSuccess: () => void,
    ) => {
      try {
        const res = await fetch(`${API_URL}/ads/${action}/${adId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        const data = await res.json();
        if (data.success) {
          showToast(successMsg, 'success');
          onSuccess();
        } else {
          showToast(`Fehler: ${data.message || 'Aktion fehlgeschlagen'}`, 'error');
        }
      } catch {
        showToast('Fehler bei der Aktion', 'error');
      }
    },
    [showToast],
  );

  const handleAIOptimize = useCallback(
    async (adId: string) => {
      showToast('KI-Optimierung gestartet...', 'success');
      try {
        const res = await fetch(`${API_URL}/ai/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ adId }),
        });
        const data = await res.json();
        showToast(data.message || 'Optimierung erfolgreich', 'success');
      } catch {
        showToast('Fehler bei der KI-Optimierung', 'error');
      }
    },
    [showToast],
  );

  const handlePriceCheck = useCallback(
    async (adId: string, title: string): Promise<{ suggestedPrice: number; reasoning: string } | null> => {
      try {
        const res = await fetch(`${API_URL}/ai/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ title }),
        });
        if (res.status === 401) { handleUnauthorized(); return null; }
        const data = await res.json();
        if (!res.ok) {
          showToast(data.message || 'Fehler bei der Preisanalyse', 'error');
          return null;
        }
        return { suggestedPrice: data.suggestedPrice, reasoning: data.reasoning };
      } catch {
        showToast('Fehler bei der Preisanalyse', 'error');
        return null;
      }
    },
    [showToast],
  );

  const handleVintedCrossPost = useCallback(
    async (adId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      try {
        const res = await fetch(`${API_URL}/ads/${adId}/cross-post/vinted`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Erfolgreich auf Vinted gepostet!', 'success');
          return { success: true, url: data.url };
        } else {
          return { success: false, error: data.message || 'Fehler beim Posten auf Vinted.' };
        }
      } catch (err) {
        return { success: false, error: 'Netzwerkfehler beim Vinted Cross-Post.' };
      }
    },
    [showToast],
  );

  const handleEbayCrossPost = useCallback(
    async (adId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      try {
        const res = await fetch(`${API_URL}/ads/${adId}/cross-post/ebay`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Erfolgreich auf eBay gepostet!', 'success');
          return { success: true, url: data.url };
        } else {
          return { success: false, error: data.message || 'Fehler beim Posten auf eBay.' };
        }
      } catch (err) {
        return { success: false, error: 'Netzwerkfehler beim eBay Cross-Post.' };
      }
    },
    [showToast],
  );

  const saveDraft = useCallback(
    async (adData: any): Promise<any> => {
      try {
        const res = await fetch(`${API_URL}/ads/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(adData),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Entwurf wurde erfolgreich gespeichert', 'success');
          return data;
        } else {
          showToast(data.message || 'Fehler beim Speichern des Entwurfs', 'error');
          return null;
        }
      } catch {
        showToast('Fehler beim Speichern des Entwurfs', 'error');
        return null;
      }
    },
    [showToast],
  );

  const optimizeExistingAd = useCallback(
    async (title: string, description: string, category: string, price: string | number): Promise<any> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn('[KI-Opt] Request aborted after 60s timeout');
      }, 60_000);

      try {
        console.log(`[KI-Opt] POST /ai/optimize-ad — title: "${title?.slice(0, 40)}", category: "${category}"`);

        const res = await fetch(`${API_URL}/ai/optimize-ad`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ title, description, category, price }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          console.warn('[KI-Opt] 401 Unauthorized — redirecting to login');
          handleUnauthorized();
          return null;
        }

        const data = await res.json().catch(() => ({}));
        console.log(`[KI-Opt] Response status: ${res.status}`, data);

        if (res.ok) {
          return data;
        } else {
          const errMsg = data.message || data.error || `HTTP ${res.status}`;
          console.error(`[KI-Opt] Error response ${res.status}:`, data);
          // Return an error object so the panel can render it
          return { __error: true, status: res.status, message: errMsg };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.error('[KI-Opt] Timed out after 30s');
          return { __error: true, status: 0, message: 'KI-Optimierung nicht verfügbar — bitte später versuchen' };
        }
        console.error('[KI-Opt] Network error:', err);
        return { __error: true, status: 0, message: err.message || 'Netzwerkfehler' };
      }
    },
    [showToast],
  );


  const updateAdFields = useCallback(
    async (adId: string, fields: { title?: string; description?: string; status?: string; repostIntervalMinutes?: number; nextRepostAt?: string; autoRepost?: boolean }): Promise<boolean> => {
      try {
        const res = await fetch(`${API_URL}/ads/${adId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(fields),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return false;
        }
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Anzeige erfolgreich aktualisiert', 'success');
          return true;
        } else {
          showToast(data.message || 'Aktualisierung fehlgeschlagen', 'error');
          return false;
        }
      } catch (err) {
        showToast('Netzwerkfehler bei der Aktualisierung', 'error');
        return false;
      }
    },
    [showToast],
  );

  return {
    fetchAds,
    syncAds,
    handleAction,
    handleAIOptimize,
    handlePriceCheck,
    handleVintedCrossPost,
    handleEbayCrossPost,
    saveDraft,
    optimizeExistingAd,
    updateAdFields,
    fetchSchedulerStatus,
    isSyncing,
    toastMessage,
    toastType,
    clearToast,
  };
}
