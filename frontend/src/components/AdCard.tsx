import React, { useState } from 'react';
import {
  Sparkles,
  Eye,
  Heart,
  MessageSquare,
  CheckCircle2,
  Clock,
  PauseCircle,
  X,
  Loader2,
  Lock
} from 'lucide-react';

export interface AdCardProps {
  ad: any;
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string) => void;
  onSchedule: (adId: string) => void;
  onVintedCrossPost: (adId: string, reserveAfterPost: boolean) => Promise<any>;
  onEbayCrossPost: (adId: string) => Promise<any>;
  onConnectVinted: () => void;
  onConnectEbay: () => void;
  isEbayConnected?: boolean;
  isVintedConnected?: boolean;
}

// Inline Vinted Logo (pink, 14px size)
const VintedLogo = () => (
  <svg 
    viewBox="0 0 100 100" 
    className="w-3.5 h-3.5 shrink-0" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 15 L45 80 L55 80 L80 15" 
      stroke="#EB6B9D" 
      strokeWidth="14" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Inline eBay Logo (small text-based multi-color SVG matching brand colors)
const EbayLogo = () => (
  <svg 
    viewBox="0 0 42 16" 
    className="h-3.5 shrink-0" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <text 
      x="0" 
      y="13" 
      fontWeight="bold" 
      fontSize="15" 
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

export function AdCard({
  ad,
  onAction,
  onAIOptimize,
  onPriceCheck,
  onSchedule,
  onVintedCrossPost,
  onEbayCrossPost,
  onConnectVinted,
  onConnectEbay,
  isEbayConnected,
  isVintedConnected,
}: AdCardProps) {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showEbayConfirm, setShowEbayConfirm] = useState(false);
  const [isPostingEbay, setIsPostingEbay] = useState(false);
  const [ebayError, setEbayError] = useState<string | null>(null);

  // Vinted State
  const [showVintedConfirm, setShowVintedConfirm] = useState(false);
  const [isPostingVinted, setIsPostingVinted] = useState(false);
  const [vintedError, setVintedError] = useState<string | null>(null);
  const [reserveAfterPost, setReserveAfterPost] = useState(true);

  const vintedConnected = isVintedConnected ?? false;
  const isVintedPosted = !!ad.vintedId || !!ad.vintedUrl;

  const ebayConnected = isEbayConnected ?? false;
  const isEbayPosted = !!ad.ebayListingId || !!ad.ebayUrl;

  const handleEbayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!ebayConnected) {
      onConnectEbay();
    } else if (isEbayPosted && ad.ebayUrl) {
      window.open(ad.ebayUrl, '_blank');
    } else {
      setShowEbayConfirm(true);
    }
  };

  const handleConfirmEbayCrossPost = async () => {
    setShowEbayConfirm(false);
    setIsPostingEbay(true);
    setEbayError(null);
    try {
      const res = await onEbayCrossPost(ad.id);
      if (!res.success) {
        setEbayError(res.error || 'Fehler beim Posten auf eBay.');
        setTimeout(() => setEbayError(null), 6000);
      }
    } catch (err) {
      setEbayError('Netzwerkfehler beim eBay-Posting.');
      setTimeout(() => setEbayError(null), 6000);
    } finally {
      setIsPostingEbay(false);
    }
  };

  const handleVintedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!vintedConnected) {
      onConnectVinted();
    } else if (isVintedPosted && ad.vintedUrl) {
      window.open(ad.vintedUrl, '_blank');
    } else {
      setShowVintedConfirm(true);
    }
  };

  const handleConfirmVintedCrossPost = async () => {
    setShowVintedConfirm(false);
    setIsPostingVinted(true);
    setVintedError(null);
    try {
      const res = await onVintedCrossPost(ad.id, reserveAfterPost);
      if (!res.success) {
        setVintedError(res.error || 'Fehler beim Posten auf Vinted.');
        setTimeout(() => setVintedError(null), 6000);
      }
    } catch (err) {
      setVintedError('Netzwerkfehler beim Vinted-Posting.');
      setTimeout(() => setVintedError(null), 6000);
    } finally {
      setIsPostingVinted(false);
    }
  };

  // Auto-Repost formatting
  const nextFormatted = ad.nextRepostAt
    ? new Date(ad.nextRepostAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : (ad.next || 'Nicht konfiguriert');

  return (
    <div className="bg-white border border-[#e5e5e5] flex flex-col md:flex-row hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-shadow">

      {/* Left side: Image & Metadata */}
      <div className="flex flex-col sm:flex-row flex-1 p-3 gap-3 border-b md:border-b-0 border-[#e5e5e5]">
        <div className="shrink-0 w-full sm:w-[130px] h-[100px] bg-[#f5f5f5] flex items-center justify-center overflow-hidden">
          <img src={ad.image} alt={ad.title} className="w-full h-full object-cover mix-blend-multiply" />
        </div>

        <div className="flex flex-col justify-between flex-1">
          <div>
            <a
              href={`https://www.kleinanzeigen.de/s-anzeige/${ad.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[16px] font-semibold text-[#333] hover:underline leading-tight mb-1 block"
              dangerouslySetInnerHTML={{ __html: ad.title }}
            />
            <div className="text-[13px] text-[#666] mb-1">{ad.category}</div>
            <div className="text-[13px] text-[#666] mb-2">{ad.date}</div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[13px] font-medium text-[#666]">
            <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {ad.views}</div>
            <div className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {ad.favorites}</div>
            <div className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {ad.messages}</div>
          </div>
        </div>
      </div>

      {/* Right side: Options & Actions (OPTIONEN Column) */}
      <div className="w-full md:w-[270px] bg-[#fdfdfd] md:border-l border-[#e5e5e5] p-3 flex flex-col justify-between shrink-0">
        
        {/* Top: Header, Price & Status Badge */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Optionen</span>
            <span className="text-[16px] font-bold text-[#333]" dangerouslySetInnerHTML={{ __html: ad.price }} />
          </div>
          
          <div className="flex items-center gap-1.5 mt-1">
            {ad.status === 'Aktiv' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Aktiv
              </span>
            )}
            {ad.status === 'Pausiert' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Pausiert
              </span>
            )}
            {ad.status === 'Reserviert' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Reserviert
              </span>
            )}
            {ad.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Entwurf
              </span>
            )}
          </div>
        </div>

        {/* Middle: Auto-Repost Switcher */}
        <div className="mb-4">
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 text-ka-green border-[#ccc] rounded-sm focus:ring-ka-green cursor-pointer"
              checked={ad.autoRepost || false}
              onChange={() => onAction('toggle-repost', ad.id, 'Auto-Repost Status aktualisiert')}
            />
            <div className="text-[13px]">
              <span className="block font-semibold text-[#333] group-hover:text-ka-green transition-colors">Auto-Repost</span>
              <span className="text-[12px] text-[#666] block">Nächster: {nextFormatted}</span>
            </div>
          </label>
        </div>

        {/* Bottom: Desktop Action Buttons Row */}
        <div className="hidden md:flex items-center gap-1.5 mt-auto w-full">
          {/* KI-Optimierung */}
          <button
            onClick={() => onAIOptimize(ad.id)}
            title="KI-Optimierung"
            className="flex-1 border border-gray-300 text-gray-700 hover:border-green-600 hover:text-green-600 hover:bg-green-50 rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-green-600" />
            <span>KI-Opt</span>
          </button>

          {/* Vinted */}
          <div className="relative flex-1 group">
            <button
              onClick={handleVintedClick}
              disabled={isPostingVinted}
              title={!vintedConnected ? "Vinted verbinden um zu aktivieren" : isVintedPosted ? "Auf Vinted ansehen →" : "Auf Vinted posten"}
              className={`w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors relative ${
                !vintedConnected
                  ? "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                  : isVintedPosted
                    ? "border-green-500 text-green-700 bg-green-50/20 hover:bg-green-50 cursor-pointer"
                    : "border-gray-300 text-gray-700 hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50 cursor-pointer"
              }`}
            >
              {isPostingVinted ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-600" />
              ) : (
                <div className="relative flex items-center">
                  <VintedLogo />
                  {!vintedConnected && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                      <Lock className="w-2 h-2 text-gray-500" />
                    </div>
                  )}
                  {isVintedPosted && (
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                  )}
                </div>
              )}
              <span className={!vintedConnected ? 'text-gray-400 opacity-80' : ''}>
                {isVintedPosted ? 'Gepostet' : 'Vinted'}
              </span>
            </button>

            {vintedError && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white text-[10px] py-1.5 px-2.5 rounded-sm shadow-xl z-20 w-48 text-center animate-in fade-in slide-in-from-bottom-1">
                <span>{vintedError}</span>
                <button 
                  onClick={() => setVintedError(null)} 
                  className="absolute top-0.5 right-1 font-bold text-white hover:text-red-200"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* eBay */}
          <div className="relative flex-1 group">
            <button
              onClick={handleEbayClick}
              disabled={isPostingEbay}
              title={!ebayConnected ? "eBay verbinden" : isEbayPosted ? "Auf eBay ansehen →" : "Auf eBay posten"}
              className={`w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors relative ${
                !ebayConnected
                  ? "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                  : isEbayPosted
                    ? "border-green-500 text-green-700 bg-green-50/20 hover:bg-green-50 cursor-pointer"
                    : "border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
              }`}
            >
              {isPostingEbay ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <div className="relative flex items-center">
                  <EbayLogo />
                  {!ebayConnected && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                      <Lock className="w-2 h-2 text-gray-500" />
                    </div>
                  )}
                  {isEbayPosted && (
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                  )}
                </div>
              )}
              <span className={!ebayConnected ? 'text-gray-400 opacity-80' : ''}>
                {isEbayPosted ? 'Gepostet' : 'eBay'}
              </span>
            </button>

            {ebayError && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white text-[10px] py-1.5 px-2.5 rounded-sm shadow-xl z-20 w-48 text-center animate-in fade-in slide-in-from-bottom-1">
                <span>{ebayError}</span>
                <button 
                  onClick={() => setEbayError(null)} 
                  className="absolute top-0.5 right-1 font-bold text-white hover:text-red-200"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Actions Collapsed Trigger */}
        <div className="flex md:hidden mt-auto w-full">
          <button
            onClick={() => setIsBottomSheetOpen(true)}
            className="w-full flex justify-center items-center gap-1.5 text-[13px] font-semibold text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-2 transition-colors"
          >
            Aktionen
          </button>
        </div>

      </div>

      {/* Mobile Bottom Sheet Modal */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsBottomSheetOpen(false)}
          />

          {/* Sheet Body */}
          <div className="relative w-full max-w-[500px] bg-white rounded-t-2xl p-5 shadow-2xl z-10 flex flex-col gap-3 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            {/* Grab Handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />

            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-gray-800 text-[16px]">Anzeigen-Optionen</h3>
              <button 
                onClick={() => setIsBottomSheetOpen(false)} 
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[12px] text-gray-500 mb-2 border-b border-gray-100 pb-2 truncate" dangerouslySetInnerHTML={{ __html: ad.title }} />

            {/* KI-Optimierung */}
            <button
              onClick={() => {
                setIsBottomSheetOpen(false);
                onAIOptimize(ad.id);
              }}
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 font-semibold text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 text-green-600" />
              <span>KI-Optimierung starten</span>
            </button>

            {/* Vinted */}
            <div className="w-full relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (!vintedConnected) {
                    setVintedError("Vinted ist nicht verbunden. Bitte verbinde es in den Einstellungen.");
                    setTimeout(() => setVintedError(null), 5000);
                  } else if (isVintedPosted && ad.vintedUrl) {
                    window.open(ad.vintedUrl, '_blank');
                    setIsBottomSheetOpen(false);
                  } else {
                    setIsBottomSheetOpen(false);
                    setShowVintedConfirm(true);
                  }
                }}
                disabled={isPostingVinted}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 border ${
                  !vintedConnected
                    ? "border-gray-200 text-gray-400 bg-gray-50/50 cursor-pointer"
                    : isVintedPosted
                      ? "border-green-500 text-green-700 bg-green-50/30 hover:bg-green-50 cursor-pointer"
                      : "border-gray-300 text-gray-700 hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50 cursor-pointer"
                }`}
              >
                {isPostingVinted ? (
                  <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
                ) : (
                  <VintedLogo />
                )}
                <span>
                  {!vintedConnected 
                    ? "Vinted (nicht verbunden)" 
                    : isVintedPosted 
                      ? "Auf Vinted (Gepostet)" 
                      : "Auf Vinted cross-posten"}
                </span>
              </button>
              {vintedError && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white text-[10px] py-1.5 px-2.5 rounded-sm shadow-xl z-20 w-48 text-center animate-in fade-in slide-in-from-bottom-1">
                  <span>{vintedError}</span>
                  <button 
                    onClick={() => setVintedError(null)} 
                    className="absolute top-0.5 right-1 font-bold text-white hover:text-red-200"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* eBay */}
            <button
              onClick={(e) => {
                setIsBottomSheetOpen(false);
                handleEbayClick(e);
              }}
              disabled={!ebayConnected}
              className={`flex items-center justify-center gap-2.5 w-full py-3 px-4 border rounded-lg font-semibold text-sm transition-colors ${
                !ebayConnected
                  ? "border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed"
                  : isEbayPosted
                    ? "border-green-500 text-green-700 bg-green-50/30 hover:bg-green-50"
                    : "border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              <EbayLogo />
              <span>
                {!ebayConnected 
                  ? "eBay (nicht verbunden)" 
                  : isEbayPosted 
                    ? "Auf eBay (Gepostet)" 
                    : "Auf eBay cross-posten"}
              </span>
            </button>

            {/* Cancel Trigger */}
            <button
              onClick={() => setIsBottomSheetOpen(false)}
              className="w-full py-3 px-4 mt-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* eBay Cross-Post Confirmation Modal */}
      {showEbayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xxs">
          <div className="bg-white rounded-sm border border-gray-200 shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
              <EbayLogo /> Inserieren bestätigen
            </h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-normal">
              Möchtest du das Produkt <strong className="text-gray-800" dangerouslySetInnerHTML={{ __html: ad.title }} /> auf eBay.de als Festpreis-Angebot inserieren?
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2.5 text-[11px] text-blue-800 font-semibold mb-4 leading-relaxed">
              Hinweis: Auf eBay.de als Festpreis-Angebot inserieren (Abholung vor Ort).
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEbayConfirm(false)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmEbayCrossPost}
                className="px-3 py-1.5 text-[12px] font-bold bg-[#A8C300] hover:bg-[#96ae00] text-white rounded-sm transition-colors"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vinted Cross-Post Confirmation Modal */}
      {showVintedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xxs">
          <div className="bg-white rounded-sm border border-gray-200 shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
              <VintedLogo /> Inserieren bestätigen
            </h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-normal">
              Möchtest du das Produkt <strong className="text-gray-800" dangerouslySetInnerHTML={{ __html: ad.title }} /> auf Vinted veröffentlichen?
            </p>
            
            <div className="flex items-start gap-2 mb-4 bg-pink-50/30 border border-pink-100/50 p-2.5 rounded-sm">
              <input
                type="checkbox"
                id="reserve-after-post"
                checked={reserveAfterPost}
                onChange={(e) => setReserveAfterPost(e.target.checked)}
                className="w-4 h-4 text-[#A8C300] border-gray-300 rounded focus:ring-[#A8C300] shrink-0 mt-0.5 cursor-pointer"
              />
              <label htmlFor="reserve-after-post" className="text-[12px] text-gray-655 select-none cursor-pointer leading-tight">
                Inserat nach dem Veröffentlichen als reserviert markieren (empfohlen für Einzelstücke)
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowVintedConfirm(false)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmVintedCrossPost}
                className="px-3 py-1.5 text-[12px] font-bold bg-[#A8C300] hover:bg-[#96ae00] text-white rounded-sm transition-colors"
              >
                Auf Vinted posten
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
