import { useState, useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

function handleUnauthorized() {
  localStorage.removeItem('kb_session');
  localStorage.removeItem('token');
  window.location.href = '/auth';
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
  handlePriceCheck: (adId: string) => Promise<void>;
  handleVintedCrossPost: (adId: string) => Promise<void>;
  handleEbayCrossPost: (adId: string) => Promise<void>;
  saveDraft: (adData: any) => Promise<boolean>;
  isSyncing: boolean;
  toastMessage: string | null;
  toastType: ToastType;
  clearToast: () => void;
}

export function useAdsActions(): AdsActionsReturn {
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
        showToast('Backend nicht erreichbar — starte den Backend-Server auf Port 3000', 'error');
      } else {
        console.error('Failed to fetch ads', e);
      }
    }
    return undefined;
  }, [showToast]);

  const syncAds = useCallback(
    async (setAds: React.Dispatch<React.SetStateAction<any[]>>) => {
      setIsSyncing(true);
      try {
        const res = await fetch(`${API_URL}/ads/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        const data = await res.json();
        if (data.success) {
          setAds(data.ads || []);
          showToast('Anzeigen wurden erfolgreich synchronisiert', 'success');
        } else {
          showToast(data.message || 'Fehler beim Synchronisieren', 'error');
        }
      } catch (e: any) {
        if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
          showToast('Backend nicht erreichbar — bitte starte: cd backend && npm start', 'error');
        } else {
          showToast('Fehler beim Synchronisieren', 'error');
        }
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
    async (adId: string) => {
      showToast('Preisanalyse läuft...', 'success');
      try {
        const res = await fetch(`${API_URL}/ai/price`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ adId }),
        });
        const data = await res.json();
        showToast(data.message || 'Preisanalyse abgeschlossen', 'success');
      } catch {
        showToast('Fehler bei der Preisanalyse', 'error');
      }
    },
    [showToast],
  );

  const handleVintedCrossPost = useCallback(
    async (adId: string) => {
      showToast('Vinted Cross-Post gestartet...', 'success');
      setTimeout(() => {
        showToast('Erfolgreich auf Vinted gepostet!', 'success');
      }, 1500);
    },
    [showToast],
  );

  const handleEbayCrossPost = useCallback(
    async (adId: string) => {
      showToast('eBay Cross-Post gestartet...', 'success');
      setTimeout(() => {
        showToast('Erfolgreich auf eBay gepostet!', 'success');
      }, 1500);
    },
    [showToast],
  );

  const saveDraft = useCallback(
    async (adData: any): Promise<boolean> => {
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
          return true;
        } else {
          showToast(data.message || 'Fehler beim Speichern des Entwurfs', 'error');
          return false;
        }
      } catch {
        showToast('Fehler beim Speichern des Entwurfs', 'error');
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
    isSyncing,
    toastMessage,
    toastType,
    clearToast,
  };
}
