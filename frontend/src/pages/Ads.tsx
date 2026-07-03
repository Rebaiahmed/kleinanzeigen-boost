import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCw, Sparkles, Loader2, AlertCircle, Search, CheckCircle2 } from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { useAds } from '../hooks/useAds';
import { useAiUsage } from '../hooks/useAiUsage';
import { useKiOptimization } from '../hooks/useKiOptimization';
import { useRepostNotifications } from '../hooks/useRepostNotifications';
import { AdGrid } from '../components/AdGrid';
import { Toast } from '../components/Toast';
import { useExtension } from '../hooks/useExtension';
import { KiPanel } from '../components/ads/KiPanel';
import { ScheduleModal } from '../components/ads/ScheduleModal';

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
  const { isConnected, contextInvalidated } = useExtension();
  const { callsCount, limit, remaining, pct, isWarning, isBlocked, incrementUsage } = useAiUsage();
  const navigate = useNavigate();
  const { ads, invalidateAds, isLoading, isFetching, isError, error } = useAds();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'views-desc' | 'views-asc' | 'messages-desc' | 'favorites-desc'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const ADS_PER_PAGE = 12;
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [scheduleModalAd, setScheduleModalAd] = useState<string | null>(null);
  const [isEbayConnected, setIsEbayConnected] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<string | null>(null);

  // Banner State
  const [isBannerDismissed, setIsBannerDismissed] = useState(
    localStorage.getItem('platform_banner_dismissed') === 'true'
  );

  const {
    syncAds,
    handleAction,
    handlePriceCheck,
    handleEbayCrossPost,
    optimizeExistingAd,
    updateAdFields,
    fetchSchedulerStatus,
    isSyncing,
    toastMessage,
    toastType,
    repostRunningId,
    repostQueuedIds,
  } = useAdsActions();

  const kiOpt = useKiOptimization(ads, optimizeExistingAd, incrementUsage, isBlocked, callsCount, limit);

  // Listen for repost notifications and prompt sync
  const handleRepostNotification = useCallback(async () => {
    setSyncError(null);
    setIsBackgroundSyncing(true);
    try {
      await syncAds(() => {});
      invalidateAds();
    } catch (e: any) {
      setSyncError(e.message || 'Synchronisierung fehlgeschlagen');
    } finally {
      setIsBackgroundSyncing(false);
    }
  }, [syncAds, invalidateAds]);

  useRepostNotifications(handleRepostNotification);

  // Platform connection status
  useEffect(() => {
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (!token) return;
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    fetch(`${apiBase}/ebay/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setIsEbayConnected(!!d.connected)).catch(() => {});
  }, []);

  // Scheduler status polling
  useEffect(() => {
    fetchSchedulerStatus().then(s => { if (s) setSchedulerStatus(s); });
    const id = setInterval(() => {
      fetchSchedulerStatus().then(s => { if (s) setSchedulerStatus(s); });
    }, 30000);
    return () => clearInterval(id);
  }, [fetchSchedulerStatus]);

  // Listen for eBay connected message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EBAY_CONNECTED') setIsEbayConnected(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const refreshAds = async () => {
    invalidateAds();
    return ads;
  };

  const handleSync = async () => {
    if (contextInvalidated) { window.location.reload(); return; }
    setSyncError(null);
    setSyncSuccess(false);
    setIsBackgroundSyncing(true);
    try {
      await syncAds(() => {});
      invalidateAds();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3500);
    } catch (e: any) {
      setSyncError(e.message || 'Synchronisierung fehlgeschlagen');
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  const handleConnectEbay = () => {
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    const width = 600, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(`${apiBase}/ebay/connect?token=${token}`, 'eBay Login', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const dismissBanner = () => {
    localStorage.setItem('platform_banner_dismissed', 'true');
    setIsBannerDismissed(true);
  };

  // eBay integration is coming soon — hide its connect banner until it's ready.
  // Flip EBAY_ENABLED to true when the eBay flow ships.
  const EBAY_ENABLED = false;
  const showBanner = EBAY_ENABLED && !isBannerDismissed && !isEbayConnected && !isLoading;

  // Always hide deleted ads (removed from Kleinanzeigen but kept in DB for history).
  // Users don't need to see deleted listings.
  const visibleAds = ads.filter((a: any) => a.listingState !== 'deleted');

  // Title search — matters more than paging at high ad counts. Case-insensitive
  // substring match on the title.
  const q = searchQuery.trim().toLowerCase();
  const searchedAds = q
    ? visibleAds.filter((a: any) => (a.title || '').toLowerCase().includes(q))
    : visibleAds;

  // Coerce a possibly-missing/string count to a number (missing → 0, so they sort
  // to the bottom of any "Meiste …" order rather than jumping around).
  const num = (v: any) => (typeof v === 'number' ? v : parseInt(v) || 0);
  // Newest-first by when the ad FIRST appeared in a sync (firstSyncedAt). Also the
  // stable tie-breaker for the metric sorts, so equal counts never jump around.
  const byNewest = (a: any, b: any) => {
    const ta = Date.parse(a.firstSyncedAt || '') || 0;
    const tb = Date.parse(b.firstSyncedAt || '') || 0;
    if (tb !== ta) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  };
  const sortedAds = [...searchedAds].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':        return -byNewest(a, b);
      case 'views-desc':    return (num(b.views) - num(a.views))         || byNewest(a, b);
      case 'views-asc':     return (num(a.views) - num(b.views))         || byNewest(a, b);
      case 'messages-desc': return (num(b.messages) - num(a.messages))   || byNewest(a, b);
      case 'favorites-desc':return (num(b.favorites) - num(a.favorites)) || byNewest(a, b);
      case 'newest':
      default:              return byNewest(a, b);
    }
  });

  // Client-side pagination — keeps the dashboard fast for large accounts (100+ ads).
  const totalPages = Math.max(1, Math.ceil(sortedAds.length / ADS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAds = sortedAds.slice((safePage - 1) * ADS_PER_PAGE, safePage * ADS_PER_PAGE);

  // Reset to page 1 when the sort order or search query changes.
  useEffect(() => { setCurrentPage(1); }, [sortBy, q]);
  // Clamp if the list shrank (e.g. an ad was deleted) and the current page no longer exists.
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

  return (
    <div className="w-full relative">
      {/* Plattformen verbinden Banner */}
      {showBanner && (
        <div className="bg-[#f2f7fb] border border-[#d1e5f5] rounded-sm p-4 mb-6 flex items-start justify-between relative shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-[14px] font-semibold text-[#0064d2] mb-1">
                Verbinde eBay um deine Anzeigen auf mehreren Plattformen zu inserieren
              </p>
              <div className="flex gap-2 mt-2">
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
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#999] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Anzeigen durchsuchen…"
              className="border border-[#ccc] bg-white rounded-sm pl-8 pr-7 py-1.5 text-[13px] text-[#333] shadow-sm focus:outline-none focus:border-[#A8C300] focus:ring-1 focus:ring-[#A8C300] w-44 sm:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#333]"
                aria-label="Suche zurücksetzen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 border border-[#ccc] bg-white rounded-sm px-2.5 py-1.5 text-[13px] text-[#333] shadow-sm">
            <span className="text-[#666] font-medium hidden sm:inline">Sortieren nach:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-transparent focus:outline-none font-semibold text-[#333] cursor-pointer">
              <option value="newest">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="views-desc">Meiste Aufrufe</option>
              <option value="views-asc">Wenigste Aufrufe</option>
              <option value="messages-desc">Meiste Nachrichten</option>
              <option value="favorites-desc">Meiste Favoriten</option>
            </select>
          </div>

          {(isFetching || isBackgroundSyncing) && ads.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 py-1.5 px-1 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />
              <span className="hidden md:inline text-[11px]">
                {isBackgroundSyncing ? `Synchronisiere ${visibleAds.length} Anzeigen…` : 'Aktualisierung…'}
              </span>
            </div>
          )}
          {contextInvalidated && (
            <span className="text-[12px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-sm">
              Erweiterung neu geladen — bitte Seite aktualisieren
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing || isBackgroundSyncing}
            className="flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isSyncing || isBackgroundSyncing) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{contextInvalidated ? 'Seite neu laden' : 'Synchronisieren'}</span>
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

      {/* Sync success confirmation (auto-hides) */}
      {syncSuccess && !syncError && (
        <div className="flex items-center gap-2 bg-[#f2f7e6] border border-[#d4e39a] rounded-sm px-4 py-2.5 mb-4 text-[13px] text-[#5a6e00]">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#7a9000]" />
          <span>{visibleAds.length} {visibleAds.length === 1 ? 'Anzeige' : 'Anzeigen'} synchronisiert.</span>
        </div>
      )}

      {/* Sync error banner */}
      {syncError && (
        <div className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-sm px-4 py-2.5 mb-4 text-[13px] text-orange-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button onClick={handleSync} className="font-semibold underline hover:no-underline shrink-0">
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Fetch error banner (React Query error) */}
      {isError && !isLoading && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-sm px-4 py-2.5 mb-4 text-[13px] text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{(error as Error)?.message || 'Fehler beim Laden der Anzeigen'}</span>
          </div>
          <button onClick={() => invalidateAds()} className="font-semibold underline hover:no-underline shrink-0">
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Sync progress bar — indeterminate (sync is one bulk operation, so there's
          no per-ad progress). Reassures during longer syncs on large accounts. */}
      {(isSyncing || isBackgroundSyncing) && (
        <div className="mb-4" role="status" aria-live="polite">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="ab-indeterminate-bar" />
          </div>
          <p className="mt-1.5 text-[12px] text-gray-500">
            {visibleAds.length > 0
              ? `Synchronisiere ${visibleAds.length} Anzeigen mit Kleinanzeigen…`
              : 'Synchronisiere deine Anzeigen mit Kleinanzeigen…'}
          </p>
        </div>
      )}

      {/* Ad list */}
      {isLoading || ((isSyncing || isBackgroundSyncing) && ads.length === 0) ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-[#e5e5e5] h-[120px] rounded-sm animate-pulse">
              <div className="flex gap-3 p-3 h-full">
                <div className="w-[130px] bg-gray-200 rounded-sm shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          <p className="mb-3">Keine Anzeigen gefunden.</p>
          <button
            onClick={handleSync}
            disabled={isSyncing || isBackgroundSyncing}
            className="inline-flex items-center gap-1.5 bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-2 px-4 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Jetzt synchronisieren
          </button>
        </div>
      ) : sortedAds.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          <Search className="w-6 h-6 mx-auto mb-3 text-[#bbb]" />
          <p className="mb-1">Keine Anzeigen für „{searchQuery}" gefunden.</p>
          <button onClick={() => setSearchQuery('')} className="text-[#A8C300] font-semibold hover:underline text-[13px]">
            Suche zurücksetzen
          </button>
        </div>
      ) : (
        <>
        <AdGrid
          ads={paginatedAds}
          onAction={(action, adId, successMsg) => handleAction(action, adId, successMsg, refreshAds)}
          onAIOptimize={(adId) => {
            const targetAd = ads.find((a: any) => a.id === adId);
            if (targetAd) kiOpt.handleStartOptimization(targetAd);
          }}
          onPriceCheck={(adId, title) => handlePriceCheck(adId, title)}
          onSchedule={(adId) => setScheduleModalAd(adId)}
          onEbayCrossPost={handleEbayCrossPost}
          onConnectEbay={handleConnectEbay}
          isEbayConnected={isEbayConnected}
          onUpdateFields={updateAdFields}
          aiBlocked={isBlocked}
          aiWarning={isWarning}
          repostRunningId={repostRunningId}
          repostQueuedIds={repostQueuedIds}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-[13px] font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Zurück
            </button>
            <span className="text-[13px] text-gray-500 px-2">
              Seite {safePage} von {totalPages}
              <span className="text-gray-400"> · {sortedAds.length} Anzeigen</span>
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-[13px] font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter →
            </button>
          </div>
        )}
        </>
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
        onPriceCheck={handlePriceCheck}
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
