import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, X, RefreshCw, Sparkles, Check, Loader2, AlertCircle, Lock } from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { AdGrid } from '../components/AdGrid';
import { Toast } from '../components/Toast';
import { useExtension } from '../hooks/useExtension';

const VintedLogo = () => (
  <svg 
    viewBox="0 0 100 100" 
    className="w-3.5 h-3.5 shrink-0" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 15 L45 80 L55 80 L80 15" 
      stroke="#09B0BA" 
      strokeWidth="14" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const EbayLogo = () => (
  <svg 
    viewBox="0 0 42 16" 
    className="h-3.5 shrink-0 flex items-center" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontWeight="bold" 
      fontSize="14" 
      fontFamily="Arial, Helvetica, sans-serif"
      letterSpacing="-0.5"
    >
      <tspan fill="#e53238">e</tspan>
      <tspan fill="#0064d2">b</tspan>
      <tspan fill="#f5af02">a</tspan>
      <tspan fill="#86b817">y</tspan>
    </text>
  </svg>
);

let adsCache: any[] | null = null;
let hasLoadedOnceCache = false;

export function Ads() {
  const { isConnected, triggerHandshake } = useExtension();
  const navigate = useNavigate();
  const [ads, setAds] = useState<any[]>(adsCache || []);
  const [sortBy, setSortBy] = useState<'views-desc' | 'views-asc'>('views-desc');
  const [isLoading, setIsLoading] = useState(!hasLoadedOnceCache && (adsCache || []).length === 0);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(hasLoadedOnceCache);
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
  const [optimizationCache, setOptimizationCache] = useState<Record<string, any>>({});
  const [loadedFromCache, setLoadedFromCache] = useState(false);
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

  const [schedulerStatus, setSchedulerStatus] = useState<string | null>(null);

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

  useEffect(() => {
    setIsBackgroundLoading(true);
    fetchAds().then((result) => {
      if (result !== undefined) {
        setAds(result);
        adsCache = result;
        hasLoadedOnceCache = true;
        setHasLoadedOnce(true);
      }
      setIsLoading(false);
      setIsBackgroundLoading(false);
    });

    fetchSchedulerStatus().then((status) => {
      if (status) setSchedulerStatus(status);
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

    // Live poll the scheduler status every 30 seconds
    const intervalId = setInterval(() => {
      fetchSchedulerStatus().then((status) => {
        if (status) setSchedulerStatus(status);
      });
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchAds, fetchSchedulerStatus]);

  // Keep module-level cache in sync with local state updates
  useEffect(() => {
    if (ads) {
      adsCache = ads;
      if (ads.length > 0) {
        hasLoadedOnceCache = true;
        setHasLoadedOnce(true);
      }
    }
  }, [ads]);

  // Listen for eBay connected message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EBAY_CONNECTED') {
        setIsEbayConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  if (!isConnected) {
    return (
      <div className="p-8 text-center bg-white rounded border border-[#ccc] shadow-sm max-w-md mx-auto my-12 text-[#666]">
        <p className="mb-4">Chrome Extension wird geladen...</p>
        <button 
          onClick={triggerHandshake}
          className="px-4 py-2 bg-[#A8C300] hover:bg-[#96ae00] text-white rounded font-medium transition-colors cursor-pointer"
        >
          Erneut verbinden
        </button>
      </div>
    );
  }

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleModalAd(null);
  };

  const refreshAds = () =>
    fetchAds().then((result) => {
      if (result !== undefined) {
        setAds(result);
        adsCache = result;
      }
    });

  const handleStartOptimization = async (ad: any, forceRefresh = false) => {
    const latestAd = ads.find((a: any) => a.id === ad.id) || ad;
    setPanelAd(latestAd);
    setOptimizePanelAdId(latestAd.id);
    setAppliedTitle(false);
    setAppliedDescription(false);

    // If cache exists and we are not forcing refresh, load from cache
    if (!forceRefresh && optimizationCache[latestAd.id]) {
      setPanelData(optimizationCache[latestAd.id]);
      setPanelError(null);
      setLoadedFromCache(true);
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
      console.error(`[KI-Opt] Panel got error: HTTP ${result.status} — ${result.message}`);
      setPanelError({ status: result.status, message: result.message });
    } else if (result) {
      setPanelData(result);
      // Save to cache
      setOptimizationCache(prev => ({
        ...prev,
        [latestAd.id]: result
      }));
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

  const handleConnectEbay = () => {
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    
    // Calculate center of screen for popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${apiBase}/ebay/connect?token=${token}`,
      'eBay Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: vintedEmail, password: vintedPassword })
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

  const sortedAds = [...ads].sort((a, b) => {
    const viewsA = typeof a.views === 'number' ? a.views : parseInt(a.views) || 0;
    const viewsB = typeof b.views === 'number' ? b.views : parseInt(b.views) || 0;
    
    if (sortBy === 'views-desc') {
      return viewsB - viewsA;
    } else {
      return viewsA - viewsB;
    }
  });

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



      {/* Vinted Connection Modal */}
      {isVintedModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#F9FAFB]">
              <h3 className="font-bold text-[16px] text-gray-800">Vinted verbinden</h3>
              <button
                onClick={() => setIsVintedModalOpen(false)}
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-[13px] text-gray-600 mb-4">
                Verbinde dein Vinted-Konto, um Anzeigen direkt aus dem Dashboard auf Vinted zu cross-posten.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Vinted E-Mail oder Benutzername
                  </label>
                  <input
                    type="text"
                    value={vintedEmail}
                    onChange={(e) => setVintedEmail(e.target.value)}
                    className="w-full p-2.5 text-[14px] border border-gray-300 rounded-sm focus:border-ka-green focus:ring-1 focus:ring-ka-green outline-none"
                    placeholder="E-Mail eingeben"
                  />
                </div>
                
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Passwort
                  </label>
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
              <button
                onClick={() => setIsVintedModalOpen(false)}
                className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
                disabled={isConnectingVinted}
              >
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
                  <button
                    onClick={handleConnectVinted}
                    className="border border-[#ccc] rounded-sm py-1.5 px-3 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all text-gray-700 bg-white hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50/50 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <VintedLogo />
                    <span>Vinted verbinden</span>
                  </button>
                )}
                {!isEbayConnected && (
                  <button
                    onClick={handleConnectEbay}
                    className="border border-[#ccc] rounded-sm py-1.5 px-3 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all text-gray-700 bg-white hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <EbayLogo />
                    <span>eBay verbinden</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={dismissBanner}
            className="text-[#0064d2] hover:text-[#004e9a] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Meine Anzeigen</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 border border-[#ccc] bg-white rounded-sm px-2.5 py-1.5 text-[13px] text-[#333] shadow-sm">
            <span className="text-[#666] font-medium hidden sm:inline">Sortieren nach:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent focus:outline-none font-semibold text-[#333] cursor-pointer"
            >
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
              syncAds(setAds).finally(() => {
                setIsBackgroundLoading(false);
              });
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
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          Keine Anzeigen gefunden. Klicke auf &quot;Synchronisieren&quot;, um deine Anzeigen von Kleinanzeigen abzurufen.
        </div>
      ) : (
        <AdGrid
          ads={sortedAds}
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
          onEbayCrossPost={handleEbayCrossPost}
          onConnectVinted={handleConnectVinted}
          onConnectEbay={handleConnectEbay}
          isEbayConnected={isEbayConnected}
          isVintedConnected={isVintedConnected}
          onUpdateFields={updateAdFields}
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
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[60] transition-transform duration-300 ease-in-out border-l border-[#e5e5e5] flex flex-col ${
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
            className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center border border-transparent hover:border-red-200"
            aria-label="Schließen"
            title="Schließen"
          >
            <X className="w-[20px] h-[20px]" />
          </button>
        </div>

        {/* Panel Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loadedFromCache && panelData && !isPanelLoading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-850 text-[12px] p-2.5 rounded-sm flex items-center justify-between gap-2 shadow-xxs">
              <span>KI-Vorschlag aus Cache geladen.</span>
              <button
                onClick={() => panelAd && handleStartOptimization(panelAd, true)}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Neu generieren</span>
              </button>
            </div>
          )}

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
              <div className="px-4">
                <p className="text-[14px] font-semibold text-gray-800 mb-1">
                  KI-Optimierung fehlgeschlagen
                </p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Der Server ist ausgelastet. Bitte klicke auf 'Erneut versuchen' oder passe deine Beschreibung an.
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
          <div className="p-4 border-t border-[#e5e5e5] bg-gray-50 flex flex-col gap-2">
            <button
              onClick={handleApplyAll}
              disabled={isApplyingAll}
              className="w-full bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-2 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isApplyingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Alle übernehmen</span>
            </button>
            <button
              onClick={() => panelAd && handleStartOptimization(panelAd, true)}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Neu generieren</span>
            </button>
          </div>
        )}
      </div>

      {/* Vinted Connection Modal */}
      {isVintedModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#F9FAFB]">
              <h3 className="font-bold text-[16px] text-gray-800">Vinted verbinden</h3>
              <button
                onClick={() => setIsVintedModalOpen(false)}
                className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-[13px] text-gray-600 mb-4">
                Verbinde dein Vinted-Konto, um Anzeigen direkt aus dem Dashboard auf Vinted zu cross-posten.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Vinted E-Mail oder Benutzername
                  </label>
                  <input
                    type="text"
                    value={vintedEmail}
                    onChange={(e) => setVintedEmail(e.target.value)}
                    className="w-full p-2.5 text-[14px] border border-gray-300 rounded-sm focus:border-ka-green focus:ring-1 focus:ring-ka-green outline-none"
                    placeholder="E-Mail eingeben"
                  />
                </div>
                
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Passwort
                  </label>
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
              <button
                onClick={() => setIsVintedModalOpen(false)}
                className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
                disabled={isConnectingVinted}
              >
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
