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
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { PhotoFeedbackModal } from './PhotoFeedbackModal';
import { SuggestPriceButton } from './SuggestPriceButton';
import { isGiveAwayAd } from '../lib/adPrice';

export interface AdCardProps {
  ad: any;
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
  onSchedule: (adId: string) => void;
  onEbayCrossPost: (adId: string) => Promise<any>;
  aiBlocked?: boolean;
  aiWarning?: boolean;
  onConnectEbay: () => void;
  isEbayConnected?: boolean;
  onUpdateFields?: (adId: string, fields: any) => Promise<boolean>;
  // Repost queue state for this card
  repostState?: 'idle' | 'running' | 'queued';
  repostBusy?: boolean; // any repost active anywhere
  repostQueuePosition?: number; // 1-based position in queue, 0 if not queued
}

// Inline eBay Logo (small text-based multi-color SVG matching brand colors)
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

const DE_DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Recurring repost intervals (minutes). Runs again every interval — client-side
// when the browser is open, server-side fallback when it's closed.
const INTERVAL_OPTIONS = [
  { label: '5 Min', value: 5 },
  { label: '10 Min', value: 10 },
  { label: '30 Min', value: 30 },
  { label: '1 Std', value: 60 },
  { label: '12 Std', value: 720 },
  { label: '24 Std', value: 1440 },
  { label: '2 Tage', value: 2880 },
  { label: '7 Tage', value: 10080 },
];

/** Human-friendly "next repost" label. */
function formatNextRepostGerman(nextRepostAt: string | null, autoRepost: boolean): string {
  if (!autoRepost || !nextRepostAt) return 'Kein Zeitplan';
  const date = new Date(nextRepostAt);
  const now = new Date();
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Heute ${timeStr}`;
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Morgen ${timeStr}`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function calculateActiveDays(ad: any): number {
  const startDate = ad.firstSyncedAt || ad.createdAt;
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function calculateViewsPerDay(ad: any): number {
  const activeDays = calculateActiveDays(ad);
  if (activeDays === 0) return 0;
  return Math.round((ad.views || 0) / activeDays);
}

async function fetchPhotoFeedback(adId: string): Promise<any> {
  if (!adId || typeof adId !== 'string') {
    throw new Error(`Ungültige Ad-ID: ${adId} (type: ${typeof adId})`);
  }

  const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
  const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

  try {
    const payload = { adId };

    const res = await fetch(`${apiUrl}/ai/photo-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return data;
  } catch (err: any) {
    throw new Error(err.message || 'Fehler beim Abrufen der Foto-Analyse');
  }
}

export function AdCard({
  ad,
  onAction,
  onAIOptimize,
  onPriceCheck,
  onSchedule,
  onEbayCrossPost,
  onConnectEbay,
  isEbayConnected,
  onUpdateFields,
  aiBlocked = false,
  aiWarning = false,
  repostState = 'idle',
  repostBusy = false,
  repostQueuePosition = 0,
}: AdCardProps) {
  const flags = useFeatureFlags();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showEbayConfirm, setShowEbayConfirm] = useState(false);
  const [isPostingEbay, setIsPostingEbay] = useState(false);
  const [ebayError, setEbayError] = useState<string | null>(null);

  // Analytics panel state
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Photo feedback state
  const [isLoadingPhotoFeedback, setIsLoadingPhotoFeedback] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<any | null>(null);
  const [photoFeedbackError, setPhotoFeedbackError] = useState<string | null>(null);
  const [showPhotoFeedbackModal, setShowPhotoFeedbackModal] = useState(false);

  // Auto-repost is gated when the listing isn't active on Kleinanzeigen.
  // State is refreshed on every sync, so this clears when a reservation is lifted.
  const repostLocked = ad.listingState === 'reserved' || ad.listingState === 'paused' || ad.listingState === 'deleted';
  const repostLockedLabel =
    ad.listingState === 'reserved' ? 'reserviert'
    : ad.listingState === 'paused' ? 'pausiert'
    : 'gelöscht';

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

  // ─── Recurring schedule (optional) ─────────────────────────────────────────
  // When set, the ad reposts every interval — client-side while the browser is
  // open, server-side fallback when it's closed. The one-time button above is
  // independent (immediate, doesn't touch the schedule).
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<number>(ad.repostIntervalMinutes || 1440);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [localAutoRepost, setLocalAutoRepost] = useState<boolean>(!!ad.autoRepost);
  const [localNextRepostAt, setLocalNextRepostAt] = useState<string | null>(ad.nextRepostAt || null);

  const handleSaveSchedule = async () => {
    if (!onUpdateFields) return;
    setIsSavingSchedule(true);
    try {
      const next = new Date(Math.ceil((Date.now() + selectedInterval * 60000) / 60000) * 60000).toISOString();
      const ok = await onUpdateFields(ad.id, {
        status: 'active',
        autoRepost: true,
        repostIntervalMinutes: selectedInterval,
        nextRepostAt: next,
      });
      if (ok) { setLocalAutoRepost(true); setLocalNextRepostAt(next); setScheduleOpen(false); }
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!onUpdateFields) return;
    setIsSavingSchedule(true);
    try {
      const ok = await onUpdateFields(ad.id, { autoRepost: false, nextRepostAt: null });
      if (ok) { setLocalAutoRepost(false); setLocalNextRepostAt(null); setScheduleOpen(false); }
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <div className="bg-white border border-[#e5e5e5] flex flex-col md:flex-row hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-shadow">

      {/* Left side: Image & Metadata */}
      <div className="flex flex-col sm:flex-row flex-1 p-2 gap-3 border-b md:border-b-0 border-[#e5e5e5]">
        <div className="relative shrink-0 w-full sm:w-[160px] h-[140px] bg-[#f5f5f5] flex items-center justify-center overflow-hidden rounded-sm">
          {(ad.image || ad.thumbnailUrl || ad.pictureUrl) ? (
            <img
              src={ad.image || ad.thumbnailUrl || ad.pictureUrl}
              alt={ad.title}
              // Dim + desaturate when the listing isn't active (reserved/paused/
              // deleted) — mirrors how Kleinanzeigen greys out such listings.
              className={`w-full h-full object-cover mix-blend-multiply transition-all ${repostLocked ? 'grayscale opacity-50' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-[#bbb] text-[11px]">Kein Bild</span>
          )}
          {ad.listingState === 'reserved' && (
            <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide text-white bg-orange-500/90 px-1.5 py-0.5 rounded-sm">
              Reserviert
            </span>
          )}
          {ad.listingState === 'deleted' && (
            <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide text-white bg-red-500/90 px-1.5 py-0.5 rounded-sm">
              Gelöscht
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <a
            href={`https://www.kleinanzeigen.de/s-anzeige/${ad.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-semibold text-[#333] hover:underline leading-snug mb-1 block line-clamp-2"
            dangerouslySetInnerHTML={{ __html: ad.title }}
          />
          <div className="text-[12px] text-[#888] mb-0.5">{ad.category}</div>
          <div className="text-[12px] text-[#888] mb-2">{ad.date}</div>

          <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-medium text-[#666]">
            <div className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {ad.views}</div>
            <div className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {ad.favorites}</div>
            <div className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {ad.messages}</div>
          </div>
        </div>
      </div>

      {/* Right side: Options & Actions (OPTIONEN Column) */}
      <div className="w-full md:w-[260px] bg-[#fdfdfd] md:border-l border-[#e5e5e5] p-2.5 flex flex-col gap-2 shrink-0">
        
        {/* Top: Header, Price & Status Badge */}
        <div>
          <div className="flex justify-between items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-[#999] uppercase tracking-wide">Optionen</span>
            <span className="text-[14px] font-bold text-[#333]" dangerouslySetInnerHTML={{ __html: ad.price }} />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
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
            {/* Live state synced from Kleinanzeigen */}
            {ad.listingState === 'reserved' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Reserviert
              </span>
            )}
            {ad.listingState === 'paused' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Pausiert
              </span>
            )}
            {ad.listingState === 'deleted' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Gelöscht
              </span>
            )}
            {/* Repost queue state */}
            {repostState === 'running' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#A8C300]/10 text-[#6f8f00] px-2 py-0.5 rounded-full border border-[#A8C300]/40">
                <Loader2 className="w-3 h-3 animate-spin" /> Läuft…
              </span>
            )}
            {repostState === 'queued' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                ⏳ In Warteschlange{repostQueuePosition > 0 ? ` (#${repostQueuePosition})` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Middle: ONE-TIME repost action. Checking it triggers a single repost;
            it shows checked only while running/queued and resets to idle when done
            (success OR failure). No recurring schedule. */}
        <div className="relative">
          <label className={`flex items-start gap-1.5 group ${repostLocked || repostState !== 'idle' ? 'cursor-default' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className={`mt-0.5 h-3.5 w-3.5 text-ka-green border-[#ccc] rounded-sm focus:ring-ka-green ${repostLocked || repostState !== 'idle' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              // ONE-TIME action: checking it triggers a single repost. Checked only
              // while running/queued; unchecks (resets to idle) when done.
              checked={repostState === 'running' || repostState === 'queued'}
              disabled={repostLocked || repostState === 'running' || repostState === 'queued'}
              onChange={() => { if (repostState === 'idle' && !repostLocked) onAction('repost', ad.id, 'Repost wird ausgeführt…'); }}
            />
            <div className="text-[12px]">
              <span className={`block font-semibold transition-colors ${repostLocked ? 'text-gray-400' : 'text-[#333] group-hover:text-ka-green'}`}>Jetzt neu einstellen</span>
              {repostLocked ? (
                <span className="text-[12px] block text-orange-600 font-medium">
                  ⏸ Pausiert — Anzeige ist {repostLockedLabel}
                </span>
              ) : ad.repostDisabledReason ? (
                <span title={ad.repostDisabledReason} className="text-[12px] block text-red-600 font-medium">
                  ⚠️ {ad.repostDisabledReason}
                </span>
              ) : (
                <span className="text-[12px] block text-[#888]">
                  {repostState === 'running'
                    ? 'Läuft… wird neu eingestellt'
                    : repostState === 'queued'
                    ? `In Warteschlange${repostQueuePosition > 0 ? ` (#${repostQueuePosition})` : ''}`
                    : 'Einmalig — stellt die Anzeige wieder ganz nach oben'}
                </span>
              )}

              {/* Repost insights (informational only — no scheduling) */}
              <div className="mt-1 space-y-0.5 text-[11px] text-gray-550">
                {(() => {
                  const count = ad.trackedRepostsCount || 0;
                  if (count === 0) {
                    return <div className="text-gray-400 italic">Führe deinen ersten Repost durch</div>;
                  } else if (count < 3) {
                    const viewsGained = ad.lastRepostViewsGained !== undefined ? ad.lastRepostViewsGained : 0;
                    return <div className="font-medium text-gray-700">📊 Letzter Repost: +{viewsGained} Aufrufe in 24h</div>;
                  } else if (count < 5) {
                    const bestDay = ad.bestDayBisher || 'Donnerstag';
                    const bestHour = ad.bestHourBisher ?? 19;
                    return <div className="font-medium text-gray-700">📈 Beste Zeit (Tipp): {bestDay}, {String(bestHour).padStart(2, '0')}:00 Uhr ({count} Reposts)</div>;
                  } else {
                    const suggestedDay = ad.aiSuggestedRepostDay ?? 4;
                    const suggestedHour = ad.aiSuggestedRepostHour ?? 19;
                    const improvement = ad.aiSuggestedImprovementPercent || 47;
                    return <div className="font-semibold text-green-700">🎯 KI-Tipp: {DE_DAYS[suggestedDay] || 'Donnerstag'}, {String(suggestedHour).padStart(2, '0')}:00 Uhr wäre eine gute Zeit (+{improvement}% mehr Aufrufe)</div>;
                  }
                })()}
              </div>
            </div>
          </label>
        </div>

        {/* Recurring schedule (optional). Runs every interval — client-side while
            the browser is open, server-side fallback when it's closed. */}
        {!repostLocked && (
          <div className="relative border-t border-gray-100 pt-1.5">
            <button
              type="button"
              onClick={() => setScheduleOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-1 text-[12px] text-gray-600 hover:text-[#A8C300] transition-colors"
            >
              <span className="flex items-center gap-1 min-w-0">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Automatisch wiederholen</span>
              </span>
              {localAutoRepost ? (
                <span className="text-[11px] text-[#6f8f00] font-medium shrink-0">
                  Nächster: {formatNextRepostGerman(localNextRepostAt, true)}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                  Aus
                </span>
              )}
            </button>

            {scheduleOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-[#d4d4d4] shadow-lg rounded-sm p-3 z-40 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Wiederhol-Intervall</span>
                  <button type="button" onClick={() => setScheduleOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedInterval(opt.value)}
                      className={`py-1 text-[10px] font-semibold rounded-sm border transition-colors ${
                        selectedInterval === opt.value
                          ? 'bg-[#A8C300] text-white border-[#A8C300]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#A8C300]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-sm px-2.5 py-1.5 mb-3">
                  Nächster Repost: <span className="font-semibold text-gray-700">
                    {formatNextRepostGerman(new Date(Date.now() + selectedInterval * 60000).toISOString(), true)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  {localAutoRepost && (
                    <button
                      type="button"
                      onClick={handleClearSchedule}
                      disabled={isSavingSchedule}
                      className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                    >
                      Zeitplan entfernen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSchedule}
                    disabled={isSavingSchedule}
                    className="ml-auto px-3 py-1.5 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-300 text-white font-bold rounded-sm text-[11px] transition-colors"
                  >
                    {isSavingSchedule ? 'Speichern…' : 'Zeitplan speichern'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom: Desktop Action Buttons — 2-col grid so the (up to 4) buttons
            reflow onto rows instead of being squeezed/clipped in one narrow row. */}
        <div className="hidden md:grid grid-cols-2 gap-1.5 w-full">
          {/* KI-Optimierung */}
          <button
            onClick={() => onAIOptimize(ad.id)}
            title={aiBlocked ? 'Monatslimit erreicht' : aiWarning ? 'Fast am Limit' : 'KI-Optimierung'}
            disabled={aiBlocked}
            className={`w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              aiBlocked
                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                : aiWarning
                ? 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'
                : 'border-gray-300 text-gray-700 hover:border-green-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${aiBlocked ? 'text-gray-300' : aiWarning ? 'text-yellow-500' : 'text-green-600'}`} />
            <span>KI-Opt</span>
          </button>

          {/* Photo Feedback */}
          <button
            onClick={async () => {
              setShowPhotoFeedbackModal(true);
              setIsLoadingPhotoFeedback(true);
              setPhotoFeedbackError(null);
              setPhotoFeedback(null);
              try {
                const result = await fetchPhotoFeedback(String(ad.id));
                setPhotoFeedback(result);
              } catch (err: any) {
                setPhotoFeedbackError(err.message);
              }
              setIsLoadingPhotoFeedback(false);
            }}
            disabled={isLoadingPhotoFeedback}
            title="Foto-Qualität analysieren (kostet 1 Analyse-Guthaben)"
            className="w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="shrink-0">📷</span>
            <span>{isLoadingPhotoFeedback ? 'Analysiert…' : 'Foto-Check'}</span>
          </button>

          {/* Vinted — gated behind feature flag */}
          {flags.enableVinted && (
            <div className="relative w-full group">
              <button
                disabled
                title="Vinted-Integration kommt in Kürze"
                className="w-full border border-gray-200 rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                <span>Vinted</span>
                <span>🚧</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                Vinted-Integration kommt in Kürze
              </div>
            </div>
          )}

          {/* Price Suggestion POC — gated behind feature flag.
              Hidden for give-away ("Zu verschenken") ads: a price suggestion is
              meaningless for an item the user is giving away for free. */}
          {flags.enablePriceSuggestion && !isGiveAwayAd(ad) && (
            <SuggestPriceButton ad={ad} />
          )}

          {/* eBay — gated behind feature flag */}
          {flags.enableEbay && (
            <div className="relative flex-1 group">
              <button
                disabled
                title="eBay-Integration kommt in Kürze"
                className="w-full border border-gray-200 rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                <span>eBay</span>
                <span>🚧</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                eBay-Integration kommt in Kürze
              </div>
            </div>
          )}

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

      {/* Expandable Analytics Panel — gated behind feature flag */}
      {showAnalytics && flags.enableAnalytics && (
        <div className="border-t border-ka-green/20 bg-green-50/40 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold text-ka-green uppercase tracking-wider">📊 Repost-Performance</h3>
            <button
              onClick={() => setShowAnalytics(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Per-repost data (mock) */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {[
              { date: 'Heute', views: 12, messages: 2, time: '14:30' },
              { date: 'Gestern', views: 8, messages: 1, time: '10:15' },
              { date: '2 Tage ago', views: 15, messages: 3, time: '09:00' },
            ].map((repost, idx) => (
              <div key={idx} className="bg-white rounded border border-ka-green/20 p-2 text-[11px]">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-800">{repost.date}</span>
                  <span className="text-gray-500 text-[10px]">{repost.time} Uhr</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-gray-500">👁 Aufrufe:</span>
                    <span className="font-bold text-ka-green ml-1">{repost.views}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">💬 Nachr.:</span>
                    <span className="font-bold text-ka-green ml-1">{repost.messages}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder when feature is disabled */}
      {showAnalytics && !flags.enableAnalytics && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-[12px] text-gray-500">Analytics-Feature ist noch nicht aktiviert</p>
        </div>
      )}


      {/* Photo Feedback Modal */}
      <PhotoFeedbackModal
        isOpen={showPhotoFeedbackModal}
        onClose={() => setShowPhotoFeedbackModal(false)}
        feedback={photoFeedback}
        photos={(() => {
          const pics = (ad.pictures || ad.images || ad.pictureUrls || []).filter((p: any) => p);
          if (pics.length === 0 && (ad.image || ad.adImage)) {
            return [ad.image || ad.adImage];
          }
          return pics;
        })()}
        isLoading={isLoadingPhotoFeedback}
        error={photoFeedbackError}
        onRetry={async () => {
          setIsLoadingPhotoFeedback(true);
          setPhotoFeedbackError(null);
          setPhotoFeedback(null);
          try {
            const result = await fetchPhotoFeedback(ad.id);
            setPhotoFeedback(result);
          } catch (err: any) {
            setPhotoFeedbackError(err.message);
          }
          setIsLoadingPhotoFeedback(false);
        }}
      />

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

            {/* Vinted — coming soon */}
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 text-gray-400 bg-gray-50/50 cursor-not-allowed"
              title="Vinted-Integration kommt in Kürze"
            >
              <span>Vinted 🚧</span>
              <span className="text-xs font-normal">(kommt bald)</span>
            </button>

            {/* eBay — coming soon */}
            <button
              disabled
              title="eBay-Integration kommt in Kürze"
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 border border-gray-200 text-gray-300 bg-gray-50/50 rounded-lg font-semibold text-sm cursor-not-allowed"
            >
              <EbayLogo />
              <span>eBay 🚧 <span className="text-xs font-normal">(kommt bald)</span></span>
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

    </div>
  );
}
