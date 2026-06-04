import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, X, RefreshCw, Sparkles, Check, Loader2, AlertCircle } from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { AdGrid } from '../components/AdGrid';
import { Toast } from '../components/Toast';

export function Ads() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleModalAd, setScheduleModalAd] = useState<string | null>(null);

  // Panel State for KI-Optimierung
  const [optimizePanelAdId, setOptimizePanelAdId] = useState<string | null>(null);
  const [panelAd, setPanelAd] = useState<any | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [panelData, setPanelData] = useState<{
    improvedTitle: string;
    improvedDescription: string;
    improvementSummary: string;
  } | null>(null);
  const [panelError, setPanelError] = useState<{ status: number; message: string } | null>(null);
  const [geminiHealth, setGeminiHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const healthPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appliedTitle, setAppliedTitle] = useState(false);
  const [appliedDescription, setAppliedDescription] = useState(false);
  const [isApplyingTitle, setIsApplyingTitle] = useState(false);
  const [isApplyingDescription, setIsApplyingDescription] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [isEbayConnected, setIsEbayConnected] = useState(false);
  const [isVintedConnected, setIsVintedConnected] = useState(false);
  const [isPostingVinted, setIsPostingVinted] = useState(false);

  const {
    fetchAds,
    syncAds,
    handleAction,
    handlePriceCheck,
    handleVintedCrossPost,
    handleEbayCrossPost,
    optimizeExistingAd,
    updateAdFields,
    isSyncing,
    toastMessage,
    toastType,
  } = useAdsActions();

  useEffect(() => {
    fetchAds().then((result) => {
      if (result !== undefined) setAds(result);
      setIsLoading(false);
    });

    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (token) {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      fetch(`${apiBase}/ebay/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setIsEbayConnected(!!data.connected);
        })
        .catch(() => {});

      fetch(`${apiBase}/vinted/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setIsVintedConnected(!!data.connected);
        })
        .catch(() => {});
    }
  }, [fetchAds]);

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

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleModalAd(null);
  };

  const refreshAds = () =>
    fetchAds().then((result) => {
      if (result !== undefined) setAds(result);
    });

  const handleStartOptimization = async (ad: any) => {
    setPanelAd(ad);
    setOptimizePanelAdId(ad.id);
    setIsPanelLoading(true);
    setPanelData(null);
    setPanelError(null);
    setAppliedTitle(false);
    setAppliedDescription(false);

    const result = await optimizeExistingAd(
      ad.title,
      ad.description || '',
      ad.category || '',
      ad.price || ''
    );

    if (result?.__error) {
      console.error(`[KI-Opt] Panel got error: HTTP ${result.status} — ${result.message}`);
      setPanelError({ status: result.status, message: result.message });
    } else if (result) {
      setPanelData(result);
    } else {
      // null result means 401 redirect already happened
      setOptimizePanelAdId(null);
    }
    setIsPanelLoading(false);
  };

  const handleApplyTitle = async () => {
    if (!optimizePanelAdId || !panelData) return;
    setIsApplyingTitle(true);
    const success = await updateAdFields(optimizePanelAdId, {
      title: panelData.improvedTitle,
    });
    if (success) {
      setAppliedTitle(true);
      await refreshAds();
    }
    setIsApplyingTitle(false);
  };

  const handleApplyDescription = async () => {
    if (!optimizePanelAdId || !panelData) return;
    setIsApplyingDescription(true);
    const success = await updateAdFields(optimizePanelAdId, {
      description: panelData.improvedDescription,
    });
    if (success) {
      setAppliedDescription(true);
      await refreshAds();
    }
    setIsApplyingDescription(false);
  };

  const handleApplyAll = async () => {
    if (!optimizePanelAdId || !panelData) return;
    setIsApplyingAll(true);
    const success = await updateAdFields(optimizePanelAdId, {
      title: panelData.improvedTitle,
      description: panelData.improvedDescription,
    });
    if (success) {
      setAppliedTitle(true);
      setAppliedDescription(true);
      await refreshAds();
      setOptimizePanelAdId(null);
    }
    setIsApplyingAll(false);
  };

  return (
    <div className="w-full relative">
      {isPostingVinted && (
        <div className="bg-pink-50 border border-pink-200 rounded-sm p-4 flex items-center justify-between shadow-sm animate-pulse mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-pink-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pink-800">
                Vinted Cross-Posting läuft...
              </p>
              <p className="text-xs text-pink-600">
                Bitte schließe dieses Fenster nicht. Der Browser-Automat veröffentlicht dein Inserat im Hintergrund.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Meine Anzeigen</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncAds(setAds)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Synchronisieren</span>
          </button>
          <button
            onClick={() => navigate('/create-with-ai')}
            className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neue Anzeige mit KI erstellen</span>
          </button>
          <button className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px]">
            Anzeige aufgeben
          </button>
        </div>
      </div>

      {/* Ad list */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Lade Anzeigen...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          Keine Anzeigen gefunden. Klicke auf &quot;Synchronisieren&quot;, um deine Anzeigen von Kleinanzeigen abzurufen.
        </div>
      ) : (
        <AdGrid
          ads={ads}
          onAction={(action, adId, successMsg) => {
            handleAction(action, adId, successMsg, refreshAds);
          }}
          onAIOptimize={(adId) => {
            const targetAd = ads.find((a) => a.id === adId);
            if (targetAd) {
              handleStartOptimization(targetAd);
            }
          }}
          onPriceCheck={(adId) => {
            handlePriceCheck(adId);
          }}
          onSchedule={(adId) => {
            setScheduleModalAd(adId);
          }}
          onVintedCrossPost={async (adId, reserveAfterPost) => {
            setIsPostingVinted(true);
            try {
              const res = await handleVintedCrossPost(adId);
              if (res.success) {
                if (reserveAfterPost) {
                  await handleAction('reserve', adId, 'Anzeige erfolgreich reserviert', refreshAds);
                } else {
                  refreshAds();
                }
              }
              return res;
            } finally {
              setIsPostingVinted(false);
            }
          }}
          onEbayCrossPost={async (adId) => {
            const res = await handleEbayCrossPost(adId);
            if (res.success) {
              refreshAds();
            }
            return res;
          }}
          isEbayConnected={isEbayConnected}
          isVintedConnected={isVintedConnected}
        />
      )}

      {/* Schedule Modal */}
      {scheduleModalAd !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#333] bg-opacity-50">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-[#e5e5e5] flex justify-between items-center">
              <h3 className="text-[16px] font-semibold text-[#333] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7C3AED]" /> Zeitplan
              </h3>
              <button onClick={() => setScheduleModalAd(null)} className="text-[#666] hover:text-[#333]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSchedule} className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#333] mb-1">Intervall</label>
                <select className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]">
                  <option>Täglich</option>
                  <option>Alle 3 Tage</option>
                  <option>Wöchentlich</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#333] mb-1">Wann?</label>
                <input
                  type="time"
                  defaultValue="18:00"
                  className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalAd(null)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#7C3AED] hover:bg-purple-700 rounded-sm transition-colors"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-in Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-40 transition-transform duration-300 ease-in-out border-l border-[#e5e5e5] flex flex-col ${
          optimizePanelAdId ? 'translate-x-0' : 'translate-x-full'
        } w-full md:w-[380px]`}
      >
        {/* Panel Header */}
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#F9FAFB]">
          <div className="flex items-center gap-2 text-green-700 font-bold text-[16px]">
            <Sparkles className="w-5 h-5 text-green-600 animate-pulse" />
            <span>KI-Optimierung</span>
            {/* Gemini health indicator dot */}
            <span
              title={geminiHealth === 'ok' ? 'Gemini verbunden' : geminiHealth === 'error' ? 'Gemini nicht erreichbar' : 'Verbindung wird geprüft...'}
              className={`w-2.5 h-2.5 rounded-full ml-1 transition-colors ${
                geminiHealth === 'ok' ? 'bg-green-400' :
                geminiHealth === 'error' ? 'bg-red-400 animate-pulse' :
                'bg-gray-300'
              }`}
            />
          </div>
          <button
            onClick={() => setOptimizePanelAdId(null)}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Ad Context (Thumbnail + Title) */}
          {panelAd && (
            <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-sm">
              <div className="shrink-0 w-[60px] h-[50px] bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={panelAd.image}
                  alt={panelAd.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold text-gray-700 truncate"
                  dangerouslySetInnerHTML={{ __html: panelAd.title }}
                />
                <div className="text-[11px] text-gray-500 font-medium">
                  {panelAd.category}
                </div>
              </div>
            </div>
          )}

          {/* Skeleton Loader while optimization API runs */}
          {isPanelLoading ? (
            <div className="space-y-6 animate-pulse">
              {/* Title Section Skeleton */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded-sm w-1/3" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                    <div className="h-8 bg-gray-100 rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                    <div className="h-8 bg-gray-200 rounded-sm" />
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded-sm w-full mt-2" />
              </div>

              {/* Description Section Skeleton */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded-sm w-1/3" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                    <div className="h-20 bg-gray-100 rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                    <div className="h-20 bg-gray-200 rounded-sm" />
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded-sm w-full mt-2" />
              </div>

              {/* Summary Skeleton */}
              <div className="h-10 bg-gray-100 rounded-sm w-full" />
            </div>
          ) : panelError ? (
            /* ── Error state ── */
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-800 mb-1">
                  KI-Optimierung fehlgeschlagen
                </p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  {panelError.message}
                  {panelError.status > 0 && (
                    <span className="block mt-1 text-[11px] text-gray-400">HTTP {panelError.status}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => panelAd && handleStartOptimization(panelAd)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold text-[13px] rounded-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Erneut versuchen
              </button>
            </div>
          ) : (
            panelData && (
              <>
                {/* Section One: Title Comparison */}
                <div className="space-y-3">
                  <h4 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1">
                    Anzeigentitel
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Title */}
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-sm uppercase">
                        Aktuell
                      </span>
                      <p
                        className="text-[12px] text-gray-500 break-words leading-snug line-clamp-4"
                        dangerouslySetInnerHTML={{ __html: panelAd?.title }}
                      />
                    </div>
                    {/* Improved Title */}
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-sm uppercase">
                        KI-Vorschlag
                      </span>
                      <p className="text-[12px] font-semibold text-gray-800 break-words leading-snug">
                        {panelData.improvedTitle}
                      </p>
                    </div>
                  </div>

                  {/* Apply Button */}
                  {appliedTitle ? (
                    <div className="w-full flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 py-1.5 rounded-sm text-[13px] font-medium">
                      <Check className="w-4 h-4" />
                      <span>Übernommen</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleApplyTitle}
                      disabled={isApplyingTitle}
                      className="w-full bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-semibold py-1.5 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1"
                    >
                      {isApplyingTitle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Übernehmen</span>
                    </button>
                  )}
                </div>

                {/* Section Two: Description Comparison */}
                <div className="space-y-3">
                  <h4 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1">
                    Beschreibung
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Description */}
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-sm uppercase">
                        Aktuell
                      </span>
                      <div className="text-[11px] text-gray-500 leading-relaxed overflow-y-auto max-h-[140px] break-words pr-1">
                        {panelAd?.description || 'Keine Beschreibung vorhanden'}
                      </div>
                    </div>
                    {/* Improved Description */}
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-sm uppercase">
                        KI-Vorschlag
                      </span>
                      <div className="text-[11px] font-medium text-gray-800 leading-relaxed overflow-y-auto max-h-[140px] break-words pr-1">
                        {panelData.improvedDescription}
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  {appliedDescription ? (
                    <div className="w-full flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 py-1.5 rounded-sm text-[13px] font-medium">
                      <Check className="w-4 h-4" />
                      <span>Übernommen</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleApplyDescription}
                      disabled={isApplyingDescription}
                      className="w-full bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-semibold py-1.5 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1"
                    >
                      {isApplyingDescription && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Übernehmen</span>
                    </button>
                  )}
                </div>

                {/* Improvement Summary */}
                <div className="p-3 bg-green-50/50 border border-green-100 rounded-sm flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-[12px] text-green-800 font-medium leading-normal">
                    {panelData.improvementSummary}
                  </p>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer Actions (Sticky) */}
        {panelData && !isPanelLoading && (
          <div className="p-4 border-t border-[#e5e5e5] bg-gray-50 flex gap-2">
            <button
              onClick={handleApplyAll}
              disabled={isApplyingAll}
              className="flex-1 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-2 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isApplyingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Alle übernehmen</span>
            </button>
          </div>
        )}
      </div>

      {/* Backdrop for panel */}
      {optimizePanelAdId && (
        <div
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-xxs transition-opacity cursor-pointer md:bg-transparent md:pointer-events-none"
          onClick={() => setOptimizePanelAdId(null)}
        />
      )}

      {/* Toast */}
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
