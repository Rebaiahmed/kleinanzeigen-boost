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

// value 0 = "Jetzt" (immediate one-time repost, not a recurring interval)
// The 5/10/15-min options are short intervals for testing the scheduler.
const INTERVAL_OPTIONS = [
  { label: 'Jetzt', value: 0 },
  { label: '5 Min', value: 5 },
  { label: '10 Min', value: 10 },
  { label: '15 Min', value: 15 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
  { label: '2 Tage', value: 2880 },
  { label: '3 Tage', value: 4320 },
  { label: '7 Tage', value: 10080 }
];

function calculateNextOccurrence(dayOfWeek: number, hour: number): string {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  
  const currentDay = now.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  
  if (daysToAdd === 0 && now.getHours() >= hour) {
    daysToAdd = 7;
  }
  
  target.setDate(now.getDate() + daysToAdd);
  return target.toISOString();
}

function formatNextRepostGerman(nextRepostAt: string | null, autoRepost: boolean): string {
  if (!autoRepost || !nextRepostAt) return 'Nicht konfiguriert';
  const date = new Date(nextRepostAt);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) {
    return `Heute ${timeStr}`;
  } else if (isTomorrow) {
    return `Morgen ${timeStr}`;
  } else {
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return `In ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}

function getSessionToken(): string | null {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
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
}: AdCardProps) {
  const flags = useFeatureFlags();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showEbayConfirm, setShowEbayConfirm] = useState(false);
  const [isPostingEbay, setIsPostingEbay] = useState(false);
  const [ebayError, setEbayError] = useState<string | null>(null);

  // Local state for optimistic UI
  const [autoRepostChecked, setAutoRepostChecked] = useState(ad.autoRepost || false);
  const [localNextRepostAt, setLocalNextRepostAt] = useState<string | null>(ad.nextRepostAt || null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Popover & AI timing states
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(ad.repostIntervalMinutes || 1440);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const [isLoadingAiSuggestion, setIsLoadingAiSuggestion] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  const handleCheckboxChange = () => {
    if (repostLocked) return; // can't enable auto-repost on a reserved/paused/deleted ad
    if (autoRepostChecked) {
      // Show confirmation modal before deactivating
      setShowDeactivateModal(true);
    } else {
      // Activating: open interval popover
      setAutoRepostChecked(true);
      setIsPopoverOpen(true);
      setShowAiSection(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    setShowDeactivateModal(false);
    setAutoRepostChecked(false);
    setLocalNextRepostAt(null);
    setIsPopoverOpen(false);
    setShowAiSection(false);
    if (onUpdateFields) {
      const ok = await onUpdateFields(ad.id, { autoRepost: false });
      if (!ok) setAutoRepostChecked(true); // revert on failure
    } else {
      onAction('toggle-repost', ad.id, 'Auto-Repost deaktiviert');
    }
  };

  const handleAiSuggestClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPopoverOpen(true);
    setShowAiSection(true);
    if (!aiSuggestion && !isLoadingAiSuggestion) {
      handleFetchAiSuggestion();
    }
  };

  const handleFetchAiSuggestion = async () => {
    setIsLoadingAiSuggestion(true);
    setAiError(null);
    try {
      const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      const token = getSessionToken();
      const res = await fetch(`${API_URL}/ai/suggest-repost-time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adId: ad.id }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setAiSuggestion(data);
      } else {
        setAiError(data.message || 'Fehler beim Laden der Vorschläge');
      }
    } catch (err) {
      setAiError('Netzwerkfehler');
    } finally {
      setIsLoadingAiSuggestion(false);
    }
  };

  const handleApplyAiSuggestion = async () => {
    if (!aiSuggestion || !onUpdateFields) return;
    setIsSavingInterval(true);
    try {
      let nextRepostAt = calculateNextOccurrence(aiSuggestion.bestDayOfWeek, aiSuggestion.bestHour);
      // Round to next full minute to align with scheduler granularity
      const futureMs = new Date(nextRepostAt).getTime();
      const nextMinute = Math.ceil(futureMs / 60000) * 60000;
      nextRepostAt = new Date(nextMinute).toISOString();

      // Must explicitly set status='active' so scheduler's query finds the ad
      const ok = await onUpdateFields(ad.id, {
        status: 'active',
        autoRepost: true,
        repostIntervalMinutes: 10080,
        nextRepostAt,
      });
      if (ok) {
        setLocalNextRepostAt(nextRepostAt);
        setAutoRepostChecked(true);
        setIsPopoverOpen(false);
      }
    } catch (err) {
      console.error('Failed to apply AI suggestion:', err);
    } finally {
      setIsSavingInterval(false);
    }
  };

  const handleSaveInterval = async () => {
    // "Jetzt" → trigger a one-time immediate repost; don't schedule a recurring interval.
    if (selectedInterval === 0) {
      setIsPopoverOpen(false);
      setAutoRepostChecked(ad.autoRepost || false); // revert optimistic check (one-time, not recurring)
      onAction('repost', ad.id, 'Repost wird ausgeführt…');
      return;
    }
    if (!onUpdateFields) return;
    setIsSavingInterval(true);
    try {
      // Round to next full minute to align with scheduler granularity (runs every minute)
      const now = Date.now();
      const futureMs = now + selectedInterval * 60 * 1000;
      const nextMinute = Math.ceil(futureMs / 60000) * 60000; // round up to next minute
      const nextRepostAt = new Date(nextMinute).toISOString();

      // Must explicitly set status='active' so scheduler's query finds the ad
      const ok = await onUpdateFields(ad.id, {
        status: 'active',
        autoRepost: true,
        repostIntervalMinutes: selectedInterval,
        nextRepostAt,
      });
      if (ok) {
        setLocalNextRepostAt(nextRepostAt);
        setAutoRepostChecked(true);
        setIsPopoverOpen(false);
      }
    } catch (err) {
      console.error('Failed to save interval:', err);
    } finally {
      setIsSavingInterval(false);
    }
  };

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

  // Auto-Repost formatting
  const nextFormatted = localNextRepostAt
    ? new Date(localNextRepostAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : (ad.next || 'Nicht konfiguriert');

  return (
    <div className="bg-white border border-[#e5e5e5] flex flex-col md:flex-row hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-shadow">

      {/* Left side: Image & Metadata */}
      <div className="flex flex-col sm:flex-row flex-1 p-3 gap-3 border-b md:border-b-0 border-[#e5e5e5]">
        <div className="relative shrink-0 w-full sm:w-[130px] h-[100px] bg-[#f5f5f5] flex items-center justify-center overflow-hidden">
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
          </div>
        </div>

        {/* Middle: Auto-Repost Switcher with Popover and AI Timing recommendation */}
        <div className="relative mb-4">
          <div className="flex items-start justify-between">
            <label className={`flex items-start gap-2 group ${repostLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className={`mt-0.5 h-3.5 w-3.5 text-ka-green border-[#ccc] rounded-sm focus:ring-ka-green ${repostLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                checked={autoRepostChecked && !repostLocked}
                disabled={repostLocked}
                onChange={handleCheckboxChange}
              />
              <div className="text-[13px]">
                <span className={`block font-semibold transition-colors ${repostLocked ? 'text-gray-400' : 'text-[#333] group-hover:text-ka-green'}`}>Auto-Repost</span>
                {repostLocked ? (
                  <span className="text-[12px] block text-orange-600 font-medium">
                    ⏸ Pausiert — Anzeige ist {repostLockedLabel}
                  </span>
                ) : !autoRepostChecked && ad.repostDisabledReason ? (
                  <div className="mt-1">
                    <span
                      title={ad.repostDisabledReason}
                      className="text-[12px] block text-red-600 font-medium mb-1"
                    >
                      ⚠️ {ad.repostDisabledReason}
                    </span>
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!onUpdateFields) return;
                        try {
                          await onUpdateFields(ad.id, { autoRepost: true, repostFailureCount: 0, repostDisabledReason: null });
                          setAutoRepostChecked(true);
                        } catch (err) {
                          console.error('Failed to re-enable auto-repost:', err);
                        }
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      [Erneut aktivieren]
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => autoRepostChecked && setIsPopoverOpen(true)}
                    className={`text-[12px] block ${autoRepostChecked ? 'text-[#666] hover:text-[#A8C300] hover:underline cursor-pointer' : 'text-[#888]'}`}
                  >
                    Nächster: {formatNextRepostGerman(localNextRepostAt, autoRepostChecked)}
                  </span>
                )}
                
                {/* Tiered statistics information */}
                <div className="mt-1 space-y-0.5 text-[11px] text-gray-550">
                  {(() => {
                    const count = ad.trackedRepostsCount || 0;
                    if (count === 0) {
                      return <div className="text-gray-400 italic">Führe deinen ersten Repost durch</div>;
                    } else if (count < 3) {
                      const viewsGained = ad.lastRepostViewsGained !== undefined ? ad.lastRepostViewsGained : 0;
                      const left = 3 - count;
                      return (
                        <>
                          <div className="font-medium text-gray-700">📊 Letzter Repost: +{viewsGained} Aufrufe in 24h</div>
                          <div className="text-gray-400 text-[10px]">Noch {left} weitere{left === 1 ? 'r' : ''} Repost{left === 1 ? '' : 's'} für KI-Empfehlung</div>
                        </>
                      );
                    } else if (count >= 3 && count < 5) {
                      const bestDay = ad.bestDayBisher || 'Donnerstag';
                      const bestHour = ad.bestHourBisher !== undefined && ad.bestHourBisher !== null ? ad.bestHourBisher : 19;
                      const formattedHour = String(bestHour).padStart(2, '0');
                      const handleApplyQuickSuggestion = async (e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!onUpdateFields) return;
                        try {
                          const nextRepostAt = calculateNextOccurrence(
                            DE_DAYS.indexOf(bestDay) === -1 ? 4 : DE_DAYS.indexOf(bestDay),
                            bestHour
                          );
                          await onUpdateFields(ad.id, {
                            autoRepost: true,
                            repostIntervalMinutes: 10080, // 7 Tage
                            nextRepostAt,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                      };
                      return (
                        <>
                          <div className="font-medium text-gray-700">📈 Beste Zeit: {bestDay}, {formattedHour}:00 Uhr ({count} Reposts)</div>
                          <button
                            type="button"
                            onClick={handleApplyQuickSuggestion}
                            className="text-[#A8C300] hover:underline font-bold text-[10px] block mt-0.5"
                          >
                            [Empfohlene Zeit übernehmen]
                          </button>
                        </>
                      );
                    } else {
                      // 5+ Reposts
                      const suggestedDay = ad.aiSuggestedRepostDay !== undefined && ad.aiSuggestedRepostDay !== null ? ad.aiSuggestedRepostDay : 4;
                      const suggestedHour = ad.aiSuggestedRepostHour !== undefined && ad.aiSuggestedRepostHour !== null ? ad.aiSuggestedRepostHour : 19;
                      const improvement = ad.aiSuggestedImprovementPercent || 47;
                      const formattedHour = String(suggestedHour).padStart(2, '0');
                      const dayName = DE_DAYS[suggestedDay] || 'Donnerstag';
                      const handleApplyAiSuggestionDirect = async (e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!onUpdateFields) return;
                        try {
                          const nextRepostAt = calculateNextOccurrence(suggestedDay, suggestedHour);
                          await onUpdateFields(ad.id, {
                            autoRepost: true,
                            repostIntervalMinutes: 10080, // 7 Tage
                            nextRepostAt,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                      };
                      return (
                        <>
                          <div className="font-semibold text-green-700">🎯 KI-Empfehlung: {dayName}, {formattedHour}:00 Uhr (+{improvement}% mehr Aufrufe erwartet)</div>
                          <button
                            type="button"
                            onClick={handleApplyAiSuggestionDirect}
                            className="text-[#A8C300] hover:underline font-bold text-[10px] block mt-0.5"
                          >
                            [Empfohlene Zeit übernehmen]
                          </button>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>
            </label>

            {/* KI-Zeitvorschlag Button */}
            {autoRepostChecked && (
              <button
                type="button"
                disabled={(ad.trackedRepostsCount || 0) < 5}
                onClick={handleAiSuggestClick}
                title={(ad.trackedRepostsCount || 0) < 5 ? "Wird verfügbar nach 5 Reposts" : "KI-Zeitvorschläge basierend auf Aufrufen erhalten"}
                className={`ml-2 text-[10px] font-semibold px-2 py-0.5 border rounded-sm transition-all whitespace-nowrap shrink-0 ${
                  (ad.trackedRepostsCount || 0) >= 5
                    ? 'border-[#A8C300] text-[#A8C300] bg-white hover:bg-green-50'
                    : 'border-gray-200 text-gray-400 bg-gray-50/50 cursor-not-allowed hidden'
                }`}
              >
                KI-Vorschlag
              </button>
            )}
          </div>

          {/* Popover scheduler options */}
          {isPopoverOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#d4d4d4] shadow-lg rounded-sm p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Repost-Intervall</span>
                <button 
                  type="button"
                  onClick={() => { setIsPopoverOpen(false); if (!ad.autoRepost) setAutoRepostChecked(false); }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Button control */}
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-0.5 rounded-sm mb-4">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedInterval(opt.value)}
                    className={`py-1 text-[10px] font-semibold rounded-sm transition-colors text-center ${
                      selectedInterval === opt.value
                        ? 'bg-white text-gray-800 shadow-xs'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Next repost preview */}
              <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-sm px-2.5 py-1.5 mb-3">
                {selectedInterval === 0 ? (
                  <>Repost: <span className="font-semibold text-gray-700">Sofort ausführen</span></>
                ) : (
                  <>Nächster Repost: <span className="font-semibold text-gray-700">
                    {formatNextRepostGerman(
                      new Date(Date.now() + selectedInterval * 60 * 1000).toISOString(),
                      true
                    )}
                  </span></>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setIsPopoverOpen(false); if (!ad.autoRepost) setAutoRepostChecked(false); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-sm text-gray-700 font-semibold text-[11px] hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSaveInterval}
                  disabled={isSavingInterval}
                  className="px-3 py-1.5 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-300 text-white font-bold rounded-sm text-[11px] transition-colors"
                >
                  {isSavingInterval ? 'Speichern...' : selectedInterval === 0 ? 'Jetzt reposten' : 'Speichern'}
                </button>
              </div>

              {/* AI suggestion recommendations */}
              {showAiSection && (
                <div className="border-t border-gray-150 pt-3 mt-3">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">KI-Empfehlung</h4>
                  
                  {isLoadingAiSuggestion ? (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 py-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analysiere Repost-Muster...</span>
                    </div>
                  ) : aiError ? (
                    <div className="text-[11px] text-red-500 bg-red-50 p-2 rounded border border-red-150">
                      {aiError}
                    </div>
                  ) : aiSuggestion ? (
                    <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-block bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                          {DE_DAYS[aiSuggestion.bestDayOfWeek]} {String(aiSuggestion.bestHour).padStart(2, '0')}:00 Uhr
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                          aiSuggestion.confidence === 'high'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : aiSuggestion.confidence === 'medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {aiSuggestion.confidence === 'high' ? 'Hoch' : aiSuggestion.confidence === 'medium' ? 'Mittel' : 'Niedrig'}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-600 italic">
                        "{aiSuggestion.reasoning}"
                      </p>

                      {aiSuggestion.secondBestOption && (
                        <div className="text-[10px] text-gray-400">
                          Alternative: {DE_DAYS[aiSuggestion.secondBestOption.dayOfWeek]} {String(aiSuggestion.secondBestOption.hour).padStart(2, '0')}:00 Uhr
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyAiSuggestion}
                        className="w-full mt-1.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-sm text-[10px] transition-colors"
                      >
                        Jetzt anwenden
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom: Desktop Action Buttons Row */}
        <div className="hidden md:flex items-center gap-1.5 mt-auto w-full">
          {/* KI-Optimierung */}
          <button
            onClick={() => onAIOptimize(ad.id)}
            title={aiBlocked ? 'Monatslimit erreicht' : aiWarning ? 'Fast am Limit' : 'KI-Optimierung'}
            disabled={aiBlocked}
            className={`flex-1 border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
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
            className="flex-1 border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="shrink-0">📷</span>
            <span>{isLoadingPhotoFeedback ? 'Analysiert…' : 'Foto-Check'}</span>
          </button>

          {/* Vinted — gated behind feature flag */}
          {flags.enableVinted && (
            <div className="relative flex-1 group">
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

          {/* Price Suggestion POC — gated behind feature flag */}
          {flags.enablePriceSuggestion && (
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

      {/* Auto-Repost deactivation confirmation modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl max-w-sm w-full p-5">
            <h3 className="text-[15px] font-bold text-[#333] mb-2">Auto-Repost deaktivieren?</h3>
            <p className="text-[13px] text-[#666] mb-5">
              Alle geplanten Reposts für diese Anzeige werden abgebrochen.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmDeactivate}
                className="px-3 py-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white rounded-sm transition-colors"
              >
                Deaktivieren
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
