import { useState, useRef, useEffect } from 'react';

export interface KiOptimizationState {
  optimizePanelAdId: string | null;
  panelAd: any | null;
  isPanelLoading: boolean;
  panelData: {
    improvedTitle: string;
    improvedDescription: string;
    improvementSummary: string;
  } | null;
  panelError: { status: number; message: string } | null;
  loadedFromCache: boolean;
  appliedTitle: boolean;
  appliedDescription: boolean;
  isApplyingTitle: boolean;
  isApplyingDescription: boolean;
  isApplyingAll: boolean;
  geminiHealth: 'unknown' | 'ok' | 'error';
}

export interface KiOptimizationHandlers {
  handleStartOptimization: (ad: any, forceRefresh?: boolean) => Promise<void>;
  handleApplyTitle: () => Promise<void>;
  handleApplyDescription: () => Promise<void>;
  handleApplyAll: () => Promise<void>;
  copyToClipboard: (text: string) => Promise<boolean>;
  setOptimizePanelAdId: (id: string | null) => void;
}

export function useKiOptimization(
  ads: any[],
  optimizeExistingAd: (title: string, description: string, category: string, price: string | number) => Promise<any>,
  incrementUsage: () => void,
  isBlocked: boolean,
  callsCount: number,
  limit: number,
): KiOptimizationState & KiOptimizationHandlers {
  const [optimizePanelAdId, setOptimizePanelAdId] = useState<string | null>(null);
  const [panelAd, setPanelAd] = useState<any | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [panelData, setPanelData] = useState<{
    improvedTitle: string;
    improvedDescription: string;
    improvementSummary: string;
  } | null>(null);
  const [panelError, setPanelError] = useState<{ status: number; message: string } | null>(null);
  const [optimizationCache, setOptimizationCache] = useState<Record<string, any>>({});
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [geminiHealth, setGeminiHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const healthPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appliedTitle, setAppliedTitle] = useState(false);
  const [appliedDescription, setAppliedDescription] = useState(false);
  const [isApplyingTitle, setIsApplyingTitle] = useState(false);
  const [isApplyingDescription, setIsApplyingDescription] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  // Poll Gemini health whenever the KI-Opt panel is open
  useEffect(() => {
    if (!optimizePanelAdId) { setGeminiHealth('unknown'); return; }
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    const checkHealth = () => {
      fetch(`${apiBase}/ai/health`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then(d => setGeminiHealth(d.ok && d.latencyMs < 2000 ? 'ok' : 'error'))
        .catch(() => setGeminiHealth('error'));
    };
    checkHealth();
    healthPollRef.current = setInterval(checkHealth, 15000);
    return () => { if (healthPollRef.current) clearInterval(healthPollRef.current); };
  }, [optimizePanelAdId]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    }
  };

  const handleStartOptimization = async (ad: any, forceRefresh = false) => {
    const latestAd = ads.find((a: any) => String(a.id) === String(ad.id)) || ad;
    setPanelAd(latestAd);
    setOptimizePanelAdId(latestAd.id);
    setAppliedTitle(false);
    setAppliedDescription(false);

    if (!forceRefresh && optimizationCache[latestAd.id]) {
      setPanelData(optimizationCache[latestAd.id]);
      setPanelError(null);
      setLoadedFromCache(true);
      setIsPanelLoading(false);
      return;
    }

    if (isBlocked) {
      setPanelError({ status: 429, message: `Tageslimit erreicht (${callsCount}/${limit}). Morgen wieder verfügbar.` });
      setIsPanelLoading(false);
      return;
    }

    setIsPanelLoading(true);
    setPanelData(null);
    setPanelError(null);
    setLoadedFromCache(false);

    const result = await optimizeExistingAd(
      latestAd.title,
      latestAd.description || '',
      latestAd.category || '',
      latestAd.price || ''
    );

    if (result?.__error) {
      setPanelError({ status: result.status, message: result.message });
    } else if (result) {
      setPanelData(result);
      setOptimizationCache(prev => ({ ...prev, [latestAd.id]: result }));
      incrementUsage();
    } else {
      setOptimizePanelAdId(null);
    }
    setIsPanelLoading(false);
  };

  const handleApplyTitle = async () => {
    if (!panelData) return;
    setIsApplyingTitle(true);
    await copyToClipboard(panelData.improvedTitle);
    setAppliedTitle(true);
    setIsApplyingTitle(false);
  };

  const handleApplyDescription = async () => {
    if (!panelData) return;
    setIsApplyingDescription(true);
    await copyToClipboard(panelData.improvedDescription);
    setAppliedDescription(true);
    setIsApplyingDescription(false);
  };

  const handleApplyAll = async () => {
    if (!panelData) return;
    setIsApplyingAll(true);
    const combined = `${panelData.improvedTitle}\n\n${panelData.improvedDescription}`;
    await copyToClipboard(combined);
    setAppliedTitle(true);
    setAppliedDescription(true);
    setIsApplyingAll(false);
  };

  return {
    optimizePanelAdId,
    panelAd,
    isPanelLoading,
    panelData,
    panelError,
    loadedFromCache,
    appliedTitle,
    appliedDescription,
    isApplyingTitle,
    isApplyingDescription,
    isApplyingAll,
    geminiHealth,
    handleStartOptimization,
    handleApplyTitle,
    handleApplyDescription,
    handleApplyAll,
    copyToClipboard,
    setOptimizePanelAdId,
  };
}
