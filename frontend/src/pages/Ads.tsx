import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCw, Sparkles, Loader2, AlertCircle, Lock } from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { useAds } from '../hooks/useAds';
import { useAiUsage } from '../hooks/useAiUsage';
import { useKiOptimization } from '../hooks/useKiOptimization';
import { AdGrid } from '../components/AdGrid';
import { Toast } from '../components/Toast';
import { useExtension } from '../hooks/useExtension';
import { KiPanel } from '../components/ads/KiPanel';
import { ScheduleModal } from '../components/ads/ScheduleModal';

const VintedLogo = () => (
  <svg viewBox="0 0 100 100" className="w-3.5 h-3.5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 15 L45 80 L55 80 L80 15" stroke="#09B0BA" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EbayLogo = () => (
  <svg viewBox="0 0 42 16" className="h-3.5 shrink-0 flex items-center" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontWeight="bold" fontSize="14" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="-0.5">
      <tspan fill="#e53238">e</tspan>
      <tspan fill="#0064d2">b</tspan>
      <tspan fill="#f5af02">a</tspan>
      <tspan fill="#86b817">y</tspan>
    </text>
  </svg>
);

export function Ads() {
  const { isConnected } = useExtension();
  const { callsCount, limit, remaining, pct, isWarning, isBlocked, incrementUsage } = useAiUsage();
  const navigate = useNavigate();
  const adsCacheRef = useRef<any[] | null>(null);
  const hasLoadedOnceCacheRef = useRef(false);

  const { ads: cachedAds, invalidateAds, isLoading: cacheLoading } = useAds();
  const [ads, setAds] = useState<any[]>([]);
  const displayAds = ads.length > 0 ? ads : cachedAds;
  const [sortBy, setSortBy] = useState<'views-desc' | 'views-asc'>('views-desc');
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [scheduleModalAd, setScheduleModalAd] = useState<string | null>(null);
  const [isEbayConnected, setIsEbayConnected] = useState(false);
  const [isVintedConnected, setIsVintedConnected] = useState(false);
  const [isPostingVinted, setIsPostingVinted] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<string | null>(null);

  // Vinted Connection Modal State
  const [isVintedModalOpen, setIsVintedModalOpen] = useState(false);
  const [vintedEmail, setVintedEmail] = useState('');
  const [vintedPassword, setVintedPassword] = useState('');
  const [isConnectingVinted, setIsConnectingVinted] = useState(false);
  const [vintedConnectError, setVintedConnectError] = useState<string | null>(null);

  // Banner State
  const [isBannerDismissed, setIsBannerDismissed] = useState(
    localStorage.getItem('platform_banner_dismissed') === 'true'
  );

  const {
    fetchAds,
    syncAds,
    handleAction,
    handlePriceCheck,
    handleVintedCrossPost,
    handleEbayCrossPost,
    optimizeExistingAd,
    updateAdFields,
    fetchSchedulerStatus,
    isSyncing,
    toastMessage,
    toastType,
  } = useAdsActions();

  const kiOpt = useKiOptimization(displayAds, optimizeExistingAd, incrementUsage, isBlocked, callsCount, limit);

  // When React Query cache resolves, stop loading
  useEffect(() => {
    if (!cacheLoading) {
      setIsLoading(false);
      if (cachedAds.length > 0) setHasLoadedOnce(true);
    }
  }, [cacheLoading, cachedAds.length]);

  // Auto-sync only if connected AND no ads loaded yet
  const hasSyncedOnConnect = useRef(false);
  useEffect(() => {
    if (isConnected && !hasSyncedOnConnect.current && ads.length === 0 && hasLoadedOnce) {
      hasSyncedOnConnect.current = true;
      setIsBackgroundLoading(true);
      syncAds(setAds).finally(() => {
        setIsBackgroundLoading(false);
        invalidateAds();
      });
    }
  }, [isConnected, ads.length, hasLoadedOnce, syncAds, invalidateAds]);

  useEffect(() => {
    if (cachedAds.length > 0) {
      setAds(cachedAds);
      setIsLoading(false);
      setHasLoadedOnce(true);
    }

    if (cachedAds.length === 0) {
      setIsBackgroundLoading(true);
      fetchAds().then((result) => {
        if (result !== undefined && result.length > 0) {
          setAds(result);
          adsCacheRef.current = result;
          hasLoadedOnceCacheRef.current = true;
          setHasLoadedOnce(true);
        }
        setIsLoading(false);
        setIsBackgroundLoading(false);
      });
    }

    fetchSchedulerStatus().then((status) => {
      if (status) setSchedulerStatus(status);
    });

    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (token) {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      fetch(`${apiBase}/ebay/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setIsEbayConnected(!!data.connected))
        .catch(() => {});

      fetch(`${apiBase}/vinted/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setIsVintedConnected(!!data.connected))
        .catch(() => {});
    }

    const intervalId = setInterval(() => {
      fetchSchedulerStatus().then((status) => {
        if (status) setSchedulerStatus(status);
      });
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchAds, fetchSchedulerStatus]);

  // Keep ref cache in sync with local state updates
  useEffect(() => {
    if (ads) {
      adsCacheRef.current = ads;
      if (ads.length > 0) {
        hasLoadedOnceCacheRef.current = true;
        setHasLoadedOnce(true);
      }
    }
  }, [ads]);

  // Listen for eBay connected message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EBAY_CONNECTED') setIsEbayConnected(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const refreshAds = async () => {
    const result = await fetchAds();
    if (result !== undefined) {
      setAds(result);
      adsCacheRef.current = result;
      return result;
    }
    return [];
  };

  const handleConnectEbay = () => {
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    const width = 600, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(`${apiBase}/ebay/connect?token=${token}`, 'eBay Login', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleConnectVinted = () => {
    setVintedEmail('');
    setVintedPassword('');
    setVintedConnectError(null);
    setIsVintedModalOpen(true);
  };

  const submitVintedConnection = async () => {
    setIsConnectingVinted(true);
    setVintedConnectError(null);
    try {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
      const res = await fetch(`${apiBase}/vinted/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: vintedEmail, password: vintedPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Verbinden mit Vinted');
      setIsVintedConnected(true);
      setIsVintedModalOpen(false);
    } catch (err: any) {
      setVintedConnectError(err.message || 'Netzwerkfehler');
    } finally {
      setIsConnectingVinted(false);
    }
  };

  const dismissBanner = () => {
    localStorage.setItem('platform_banner_dismissed', 'true');
    setIsBannerDismissed(true);
  };

  const showBanner = !isBannerDismissed && (!isEbayConnected || !isVintedConnected) && !isLoading;

  const sortedAds = [...displayAds].sort((a, b) => {
    const viewsA = typeof a.views === 'number' ? a.views : parseInt(a.views) || 0;
    const viewsB = typeof b.views === 'number' ? b.views : parseInt(b.views) || 0;
    return sortBy === 'views-desc' ? viewsB - viewsA : viewsA - viewsB;
  });

  return (
    <div className="w-full relative">
      {isPostingVinted && (
        <div className="bg-pink-50 border border-pink-200 rounded-sm p-4 flex items-center justify-between shadow-sm animate-pulse mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-pink-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pink-800">Vinted Cross-Posting läuft...</p>
              <p className="text-xs text-pink-600">Bitte schließe dieses Fenster nicht. Der Browser-Automat veröffentlicht dein Inserat im Hintergrund.</p>
            </div>
          </div>
        </div>
      )}

      {/* Vinted Connection Modal */}
      {isVintedModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#F9FAFB]">
              <h3 className="font-bold text-[16px] text-gray-800">Vinted verbinden</h3>
              <button onClick={() => setIsVintedModalOpen(false)} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-[13px] text-gray-600 mb-4">
                Verbinde dein Vinted-Konto, um Anzeigen direkt aus dem Dashboard auf Vinted zu cross-posten.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Vinted E-Mail oder Benutzername</label>
                  <input
                    type="text"
                    value={vintedEmail}
                    onChange={(e) => setVintedEmail(e.target.value)}
                    className="w-full p-2.5 text-[14px] border border-gray-300 rounded-sm focus:border-ka-green focus:ring-1 focus:ring-ka-green outline-none"
                    placeholder="E-Mail eingeben"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Passwort</label>
                  <input
                    type="password"
                    value={vintedPassword}
                    onChange={(e) => setVintedPassword(e.target.value)}
                    className="w-full p-2.5 text-[14px] border border-gray-300 rounded-sm focus:border-ka-green focus:ring-1 focus:ring-ka-green outline-none"
                    placeholder="Passwort eingeben"
                  />
                </div>
                <div className="bg-green-50 border border-green-100 p-3 rounded-sm flex items-start gap-2 mt-2">
                  <Lock className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-green-800 leading-relaxed">
                    Deine Zugangsdaten werden mit starker AES-256 Verschlüsselung auf unseren Servern gespeichert und ausschließlich für automatisierte Cross-Posts verwendet.
                  </p>
                </div>
              </div>
              {vintedConnectError && (
                <div className="mt-4 bg-red-50 text-red-600 text-[13px] p-3 rounded-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{vintedConnectError}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#e5e5e5] bg-[#F9FAFB] flex justify-end gap-3">
              <button onClick={() => setIsVintedModalOpen(false)} className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:text-gray-800 transition-colors" disabled={isConnectingVinted}>
                Abbrechen
              </button>
              <button
                onClick={submitVintedConnection}
                disabled={!vintedEmail || !vintedPassword || isConnectingVinted}
                className="bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-sm font-semibold text-[14px] flex items-center gap-2 transition-colors"
              >
                {isConnectingVinted && <Loader2 className="w-4 h-4 animate-spin" />}
                Verbinden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plattformen verbinden Banner */}
      {showBanner && (
        <div className="bg-[#f2f7fb] border border-[#d1e5f5] rounded-sm p-4 mb-6 flex items-start justify-between relative shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-[14px] font-semibold text-[#0064d2] mb-1">
                Verbinde Vinted und eBay um deine Anzeigen auf mehreren Plattformen zu inserieren
              </p>
              <div className="flex gap-2 mt-2">
                {!isVintedConnected && (
                  <button onClick={handleConnectVinted} className="border border-[#ccc] rounded-sm py-1.5 px-3 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all text-gray-700 bg-white hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50/50 cursor-pointer shadow-sm hover:shadow-md">
                    <VintedLogo />
                    <span>Vinted verbinden</span>
                  </button>
                )}
                {!isEbayConnected && (
                  <button onClick={handleConnectEbay} className="border border-[#ccc] rounded-sm py-1.5 px-3 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all text-gray-700 bg-white hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 cursor-pointer shadow-sm hover:shadow-md">
                    <EbayLogo />
                    <span>eBay verbinden</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <button onClick={dismissBanner} className="text-[#0064d2] hover:text-[#004e9a] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Meine Anzeigen</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 border border-[#ccc] bg-white rounded-sm px-2.5 py-1.5 text-[13px] text-[#333] shadow-sm">
            <span className="text-[#666] font-medium hidden sm:inline">Sortieren nach:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-transparent focus:outline-none font-semibold text-[#333] cursor-pointer">
              <option value="views-desc">Meiste Aufrufe</option>
              <option value="views-asc">Wenigste Aufrufe</option>
            </select>
          </div>

          {isBackgroundLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 py-1.5 px-1 animate-pulse shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              <span className="hidden md:inline">Datenbank-Check...</span>
            </div>
          )}
          <button
            onClick={() => {
              setIsBackgroundLoading(true);
              syncAds(setAds).finally(() => { setIsBackgroundLoading(false); invalidateAds(); });
            }}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Synchronisieren</span>
          </button>
          <button
            onClick={() => navigate('/neue-anzeige-mit-ki-erstellen')}
            className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neue Anzeige mit KI erstellen</span>
          </button>
        </div>
      </div>

      {/* Ad list */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Lade Anzeigen...</div>
      ) : displayAds.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          Keine Anzeigen gefunden. Klicke auf &quot;Synchronisieren&quot;, um deine Anzeigen von Kleinanzeigen abzurufen.
        </div>
      ) : (
        <AdGrid
          ads={sortedAds}
          onAction={(action, adId, successMsg) => handleAction(action, adId, successMsg, refreshAds)}
          onAIOptimize={(adId) => {
            const targetAd = displayAds.find((a) => a.id === adId);
            if (targetAd) kiOpt.handleStartOptimization(targetAd);
          }}
          onPriceCheck={(adId, title) => handlePriceCheck(adId, title)}
          onSchedule={(adId) => setScheduleModalAd(adId)}
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
          onEbayCrossPost={handleEbayCrossPost}
          onConnectVinted={handleConnectVinted}
          onConnectEbay={handleConnectEbay}
          isEbayConnected={isEbayConnected}
          isVintedConnected={isVintedConnected}
          onUpdateFields={updateAdFields}
          aiBlocked={isBlocked}
          aiWarning={isWarning}
        />
      )}

      {/* Scheduler Footer Indicator */}
      {schedulerStatus && (
        <div className="mt-8 text-center text-[12px] text-gray-500">
          Scheduler aktiv — letzte Prüfung: {(() => {
            const diffMinutes = Math.floor((Date.now() - new Date(schedulerStatus).getTime()) / 60000);
            if (diffMinutes <= 0) return 'vor weniger als einer Minute';
            if (diffMinutes === 1) return 'vor 1 Minute';
            return `vor ${diffMinutes} Minuten`;
          })()}
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleModal adId={scheduleModalAd} onClose={() => setScheduleModalAd(null)} />

      {/* KI Panel */}
      <KiPanel
        optimizePanelAdId={kiOpt.optimizePanelAdId}
        panelAd={kiOpt.panelAd}
        isPanelLoading={kiOpt.isPanelLoading}
        panelData={kiOpt.panelData}
        panelError={kiOpt.panelError}
        loadedFromCache={kiOpt.loadedFromCache}
        appliedTitle={kiOpt.appliedTitle}
        appliedDescription={kiOpt.appliedDescription}
        isApplyingTitle={kiOpt.isApplyingTitle}
        isApplyingDescription={kiOpt.isApplyingDescription}
        isApplyingAll={kiOpt.isApplyingAll}
        geminiHealth={kiOpt.geminiHealth}
        isBlocked={isBlocked}
        isWarning={isWarning}
        callsCount={callsCount}
        limit={limit}
        remaining={remaining}
        pct={pct}
        onClose={() => kiOpt.setOptimizePanelAdId(null)}
        onStartOptimization={kiOpt.handleStartOptimization}
        onApplyTitle={kiOpt.handleApplyTitle}
        onApplyDescription={kiOpt.handleApplyDescription}
        onApplyAll={kiOpt.handleApplyAll}
      />

      {/* Backdrop for panel */}
      {kiOpt.optimizePanelAdId && (
        <div
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-xxs transition-opacity cursor-pointer md:bg-transparent md:pointer-events-none"
          onClick={() => kiOpt.setOptimizePanelAdId(null)}
        />
      )}

      {/* Toast */}
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
