import React, { useState } from 'react';
import {
  Sparkles,
  Eye,
  Heart,
  MessageSquare,
  CheckCircle2,
  Clock,
  PauseCircle,
  X
} from 'lucide-react';

export interface AdCardProps {
  ad: any;
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string) => void;
  onSchedule: (adId: string) => void;
  onVintedCrossPost: (adId: string) => void;
  onEbayCrossPost: (adId: string) => void;
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
}: AdCardProps) {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Dynamic connection and posted states for Vinted & eBay (using ad properties with deterministic fallbacks)
  const isVintedConnected = ad.vintedConnected ?? (parseInt(ad.id) % 3 !== 0);
  const isVintedPosted = ad.vintedPosted ?? (isVintedConnected && parseInt(ad.id) % 2 === 0);

  const isEbayConnected = ad.ebayConnected ?? (parseInt(ad.id) % 4 !== 0);
  const isEbayPosted = ad.ebayPosted ?? (isEbayConnected && parseInt(ad.id) % 2 !== 0);

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
          <button
            onClick={() => isVintedConnected && onVintedCrossPost(ad.id)}
            disabled={!isVintedConnected}
            title={!isVintedConnected ? "Vinted nicht verbunden" : isVintedPosted ? "Gepostet auf Vinted" : "Auf Vinted posten"}
            className={`flex-1 border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors ${
              !isVintedConnected
                ? "border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed"
                : isVintedPosted
                  ? "border-green-500 text-green-700 bg-green-50/20 hover:bg-green-50"
                  : "border-gray-300 text-gray-700 hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50"
            }`}
          >
            <VintedLogo />
            <span>Vinted</span>
          </button>

          {/* eBay */}
          <button
            onClick={() => isEbayConnected && onEbayCrossPost(ad.id)}
            disabled={!isEbayConnected}
            title={!isEbayConnected ? "eBay nicht verbunden" : isEbayPosted ? "Gepostet auf eBay" : "Auf eBay posten"}
            className={`flex-1 border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors ${
              !isEbayConnected
                ? "border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed"
                : isEbayPosted
                  ? "border-green-500 text-green-700 bg-green-50/20 hover:bg-green-50"
                  : "border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50"
            }`}
          >
            <EbayLogo />
            <span>eBay</span>
          </button>
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
            <button
              onClick={() => {
                if (isVintedConnected) {
                  setIsBottomSheetOpen(false);
                  onVintedCrossPost(ad.id);
                }
              }}
              disabled={!isVintedConnected}
              className={`flex items-center justify-center gap-2.5 w-full py-3 px-4 border rounded-lg font-semibold text-sm transition-colors ${
                !isVintedConnected
                  ? "border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed"
                  : isVintedPosted
                    ? "border-green-500 text-green-700 bg-green-50/30 hover:bg-green-50"
                    : "border-gray-300 text-gray-700 hover:border-pink-500 hover:text-pink-600 hover:bg-pink-50"
              }`}
            >
              <VintedLogo />
              <span>
                {!isVintedConnected 
                  ? "Vinted (nicht verbunden)" 
                  : isVintedPosted 
                    ? "Auf Vinted (Gepostet)" 
                    : "Auf Vinted cross-posten"}
              </span>
            </button>

            {/* eBay */}
            <button
              onClick={() => {
                if (isEbayConnected) {
                  setIsBottomSheetOpen(false);
                  onEbayCrossPost(ad.id);
                }
              }}
              disabled={!isEbayConnected}
              className={`flex items-center justify-center gap-2.5 w-full py-3 px-4 border rounded-lg font-semibold text-sm transition-colors ${
                !isEbayConnected
                  ? "border-gray-200 text-gray-300 bg-gray-50/50 cursor-not-allowed"
                  : isEbayPosted
                    ? "border-green-500 text-green-700 bg-green-50/30 hover:bg-green-50"
                    : "border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              <EbayLogo />
              <span>
                {!isEbayConnected 
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

    </div>
  );
}
