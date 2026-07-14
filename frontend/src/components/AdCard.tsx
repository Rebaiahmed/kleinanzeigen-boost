import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Lock,
  AlertTriangle
} from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { PhotoFeedbackModal } from './PhotoFeedbackModal';
import { SuggestPriceButton } from './SuggestPriceButton';
import { isGiveAwayAd } from '../lib/adPrice';
import { computeNextSmartRepost } from '../lib/smart-repost';

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

// Recurring repost intervals (minutes). Runs again every interval — client-side
// when the browser is open, server-side fallback when it's closed.
// Manual mode intervals (5/10min removed — ineffective + bot-like). Smart Repost
// is the recommended default; these are the "advanced" fallback.
const MANUAL_INTERVAL_OPTIONS = [
  { labelKey: 'interval24h', value: 1440 },
  { labelKey: 'interval3d', value: 4320 },
  { labelKey: 'interval7d', value: 10080 },
];

/** Human-friendly "next repost" label, locale-aware. */
function formatNextRepost(nextRepostAt: string | null, autoRepost: boolean, t: (key: string, opts?: any) => string, locale: string): string {
  if (!autoRepost || !nextRepostAt) return t('adCard.noSchedule');
  const date = new Date(nextRepostAt);
  const now = new Date();
  // Past due: the scheduled time has passed but it hasn't reposted yet (e.g. the
  // browser is closed, so the server fallback handles it within ~15 min). Showing
  // the stale past time as "Nächster" looks broken — show a pending state instead.
  if (date.getTime() <= now.getTime()) return t('adCard.duePending');
  const localeCode = locale === 'en' ? 'en-US' : 'de-DE';
  const timeStr = date.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return t('adCard.todayAt', { time: timeStr });
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return t('adCard.tomorrowAt', { time: timeStr });
  return date.toLocaleDateString(localeCode, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
  const { t, i18n } = useTranslation();
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
    ad.listingState === 'reserved' ? t('adCard.repostLockedReserved')
    : ad.listingState === 'paused' ? t('adCard.repostLockedPaused')
    : t('adCard.repostLockedDeleted');

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
        setEbayError(res.error || t('adCard.ebayPostError'));
        setTimeout(() => setEbayError(null), 6000);
      }
    } catch (err) {
      setEbayError(t('adCard.ebayNetworkError'));
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
  const [repostMode, setRepostMode] = useState<'smart' | 'manual'>(ad.repostMode || 'smart');
  const [selectedInterval, setSelectedInterval] = useState<number>(
    [1440, 4320, 10080].includes(ad.repostIntervalMinutes) ? ad.repostIntervalMinutes : 1440,
  );
  const [titleA, setTitleA] = useState<string>(ad.smartVariation?.titleVariants?.[0] ?? (ad.title || ''));
  const [titleB, setTitleB] = useState<string>(ad.smartVariation?.titleVariants?.[1] ?? '');
  const [rotatePhotos, setRotatePhotos] = useState<boolean>(!!ad.smartVariation?.rotatePhotos);
  const [priceStep, setPriceStep] = useState<number>(ad.smartVariation?.priceStepPercent ?? 0);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [localAutoRepost, setLocalAutoRepost] = useState<boolean>(!!ad.autoRepost);
  const [localNextRepostAt, setLocalNextRepostAt] = useState<string | null>(ad.nextRepostAt || null);
  // One-time "what changed" callout for users who already had a schedule.
  const [showSmartCallout, setShowSmartCallout] = useState<boolean>(
    () => localStorage.getItem('ab_smart_repost_seen') !== '1',
  );

  const hasVariation = [titleA, titleB].filter((s) => s.trim()).length >= 2 || rotatePhotos || priceStep > 0;

  // Reposting deletes the listing and recreates it — views/favorites/messages
  // reset to zero on the new one. Warn before that happens, but only when
  // there's actually something to lose, and only at the human decision point:
  // the instant "Jetzt" click, or the FIRST time a listing's auto-repost is
  // switched on (subsequent scheduled reposts already had this trade-off
  // accepted, and there's no user present to confirm an unattended cron run).
  const statViews = Number(ad.views) || 0;
  const statFavorites = Number(ad.favorites) || 0;
  const statMessages = Number(ad.messages) || 0;
  const hasStatsToLose = statViews > 0 || statFavorites > 0 || statMessages > 0;
  const [confirmRepostAction, setConfirmRepostAction] = useState<null | 'instant' | 'schedule'>(null);

  const doSaveSchedule = async () => {
    if (!onUpdateFields) return;
    setIsSavingSchedule(true);
    try {
      let payload: any;
      let next: string;
      if (repostMode === 'smart') {
        const titleVariants = [titleA, titleB].map((s) => s.trim()).filter(Boolean);
        next = computeNextSmartRepost(Date.now());
        payload = {
          status: 'active', autoRepost: true, repostMode: 'smart', nextRepostAt: next,
          smartVariation: {
            ...(titleVariants.length >= 2 ? { titleVariants } : {}),
            rotatePhotos,
            priceStepPercent: priceStep || 0,
          },
        };
      } else {
        next = new Date(Math.ceil((Date.now() + selectedInterval * 60000) / 60000) * 60000).toISOString();
        payload = { status: 'active', autoRepost: true, repostMode: 'manual', repostIntervalMinutes: selectedInterval, nextRepostAt: next };
      }
      const ok = await onUpdateFields(ad.id, payload);
      if (ok) { setLocalAutoRepost(true); setLocalNextRepostAt(next); setScheduleOpen(false); }
    } finally {
      setIsSavingSchedule(false);
    }
  };

  /** Button handler: only warn when this is the FIRST time auto-repost is
   *  switched on for this listing — editing an already-active schedule's
   *  variation settings doesn't need re-confirming. */
  const handleSaveSchedule = () => {
    if (!localAutoRepost && hasStatsToLose) { setConfirmRepostAction('schedule'); return; }
    void doSaveSchedule();
  };

  const confirmRepostWarning = () => {
    const action = confirmRepostAction;
    setConfirmRepostAction(null);
    if (action === 'instant') onAction('repost', ad.id, t('adCard.repostRunningAction'));
    else if (action === 'schedule') void doSaveSchedule();
  };

  const dismissSmartCallout = () => { localStorage.setItem('ab_smart_repost_seen', '1'); setShowSmartCallout(false); };

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
            <span className="text-[#bbb] text-[11px]">{t('adCard.noImage')}</span>
          )}
          {ad.listingState === 'reserved' && (
            <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide text-white bg-orange-500/90 px-1.5 py-0.5 rounded-sm">
              {t('adCard.reserved')}
            </span>
          )}
          {ad.listingState === 'deleted' && (
            <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide text-white bg-red-500/90 px-1.5 py-0.5 rounded-sm">
              {t('adCard.deleted')}
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
            <span className="text-[11px] font-semibold text-[#999] uppercase tracking-wide">{t('adCard.options')}</span>
            <span className="text-[14px] font-bold text-[#333]" dangerouslySetInnerHTML={{ __html: ad.price }} />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {ad.status === 'Aktiv' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {t('adCard.active')}
              </span>
            )}
            {ad.status === 'Pausiert' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> {t('adCard.paused')}
              </span>
            )}
            {ad.status === 'Reserviert' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {t('adCard.reserved')}
              </span>
            )}
            {ad.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> {t('adCard.draft')}
              </span>
            )}
            {/* Live state synced from Kleinanzeigen */}
            {ad.listingState === 'reserved' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {t('adCard.reserved')}
              </span>
            )}
            {ad.listingState === 'paused' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> {t('adCard.paused')}
              </span>
            )}
            {ad.listingState === 'deleted' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {t('adCard.deleted')}
              </span>
            )}
            {/* Repost queue state */}
            {repostState === 'running' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#A8C300]/10 text-[#6f8f00] px-2 py-0.5 rounded-full border border-[#A8C300]/40">
                <Loader2 className="w-3 h-3 animate-spin" /> {t('adCard.running')}
              </span>
            )}
            {repostState === 'queued' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                ⏳ {repostQueuePosition > 0 ? t('adCard.queuedPosition', { position: repostQueuePosition }) : t('adCard.queuedNoPosition')}
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
              onChange={() => {
                if (repostState !== 'idle' || repostLocked) return;
                if (hasStatsToLose) setConfirmRepostAction('instant');
                else onAction('repost', ad.id, t('adCard.repostRunningAction'));
              }}
            />
            <div className="text-[12px]">
              <span className={`block font-semibold transition-colors ${repostLocked ? 'text-gray-400' : 'text-[#333] group-hover:text-ka-green'}`}>{t('adCard.repostNow')}</span>
              {repostLocked ? (
                <span className="text-[12px] block text-orange-600 font-medium">
                  {t('adCard.pausedListing', { state: repostLockedLabel })}
                </span>
              ) : ad.repostDisabledReason ? (
                <span title={ad.repostDisabledReason} className="text-[12px] block text-red-600 font-medium">
                  ⚠️ {ad.repostDisabledReason}
                </span>
              ) : (
                <span className="text-[12px] block text-[#888]">
                  {repostState === 'running'
                    ? t('adCard.repostRunning')
                    : repostState === 'queued'
                    ? (repostQueuePosition > 0 ? t('adCard.queuedPosition', { position: repostQueuePosition }) : t('adCard.queuedNoPosition'))
                    : t('adCard.repostOnce')}
                </span>
              )}

              {/* Repost insights (informational only — no scheduling) */}
              <div className="mt-1 space-y-0.5 text-[11px] text-gray-550">
                {(() => {
                  const count = ad.trackedRepostsCount || 0;
                  const days = t('adCard.days', { returnObjects: true }) as string[];
                  if (count === 0) {
                    return <div className="text-gray-400 italic">{t('adCard.firstRepost')}</div>;
                  } else if (count < 3) {
                    const viewsGained = ad.lastRepostViewsGained !== undefined ? ad.lastRepostViewsGained : 0;
                    return <div className="font-medium text-gray-700">{t('adCard.lastRepostGain', { views: viewsGained })}</div>;
                  } else if (count < 5) {
                    const bestDay = ad.bestDayBisher || days[4];
                    const bestHour = ad.bestHourBisher ?? 19;
                    return <div className="font-medium text-gray-700">{t('adCard.bestTimeTip', { day: bestDay, hour: `${String(bestHour).padStart(2, '0')}:00`, count })}</div>;
                  } else {
                    const suggestedDay = ad.aiSuggestedRepostDay ?? 4;
                    const suggestedHour = ad.aiSuggestedRepostHour ?? 19;
                    const improvement = ad.aiSuggestedImprovementPercent || 47;
                    return <div className="font-semibold text-green-700">{t('adCard.aiTip', { day: days[suggestedDay] || days[4], hour: `${String(suggestedHour).padStart(2, '0')}:00`, improvement })}</div>;
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
                <span className="truncate">{t('adCard.autoRepeat')}</span>
              </span>
              {localAutoRepost ? (
                (() => {
                  const due = !!localNextRepostAt && new Date(localNextRepostAt).getTime() <= Date.now();
                  const formatted = formatNextRepost(localNextRepostAt, true, t, i18n.language);
                  return (
                    <span className={`text-[11px] font-medium shrink-0 ${due ? 'text-[#c2620a]' : 'text-[#6f8f00]'}`}>
                      {due ? formatted : t('adCard.nextRepost', { time: formatted })}
                    </span>
                  );
                })()
              ) : (
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                  {t('adCard.off')}
                </span>
              )}
            </button>

            {scheduleOpen && (
              <div className="absolute right-0 top-full mt-1 w-[19rem] bg-white border border-[#d4d4d4] shadow-lg rounded-sm p-3 z-40 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{t('adCard.repostMode')}</span>
                  <button type="button" onClick={() => setScheduleOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* One-time "what changed" callout */}
                {showSmartCallout && (
                  <div className="relative bg-[#f2f7e6] border border-[#d4e39a] rounded-sm px-2.5 py-2 mb-3 text-[11px] text-[#5a6e00] leading-snug">
                    <button type="button" onClick={dismissSmartCallout} aria-label={t('adCard.close')} className="absolute top-1 right-1 text-[#7a9000] hover:text-[#5a6e00]"><X className="w-3 h-3" /></button>
                    <span className="font-semibold">{t('adCard.smartCalloutTitle')}</span> {t('adCard.smartCalloutText')}
                  </div>
                )}

                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {([['smart', t('adCard.smartRecommended')], ['manual', t('adCard.manual')]] as const).map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => setRepostMode(m)}
                      className={`py-1.5 text-[11px] font-semibold rounded-sm border transition-colors ${
                        repostMode === m ? 'bg-[#A8C300] text-white border-[#A8C300]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#A8C300]'
                      }`}>{lbl}</button>
                  ))}
                </div>

                {repostMode === 'smart' ? (
                  <div className="space-y-2 mb-3">
                    <p className="text-[11px] text-gray-500 leading-snug">
                      {t('adCard.smartHint')}
                    </p>
                    {/* Variations */}
                    <div className="space-y-1.5 border border-gray-100 rounded-sm p-2">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{t('adCard.variationsOptional')}</span>
                      <input value={titleA} onChange={(e) => setTitleA(e.target.value)} placeholder={t('adCard.titleVariantA')} className="w-full border border-gray-200 rounded-sm px-2 py-1 text-[11px] focus:outline-none focus:border-[#A8C300]" />
                      <input value={titleB} onChange={(e) => setTitleB(e.target.value)} placeholder={t('adCard.titleVariantB')} className="w-full border border-gray-200 rounded-sm px-2 py-1 text-[11px] focus:outline-none focus:border-[#A8C300]" />
                      <label className="flex items-center gap-2 text-[11px] text-gray-600">
                        <input type="checkbox" checked={rotatePhotos} onChange={(e) => setRotatePhotos(e.target.checked)} className="h-3.5 w-3.5" />
                        {t('adCard.rotatePhotos')}
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-gray-600">
                        {t('adCard.lowerPriceBy')}
                        <input type="number" min={0} max={90} value={priceStep} onChange={(e) => setPriceStep(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} className="w-14 border border-gray-200 rounded-sm px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-[#A8C300]" />
                        {t('adCard.perRepost')}
                      </label>
                    </div>
                    {!hasVariation && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1 leading-snug">
                        {t('adCard.noVariationTip')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      {MANUAL_INTERVAL_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setSelectedInterval(opt.value)}
                          className={`py-1 text-[11px] font-semibold rounded-sm border transition-colors ${
                            selectedInterval === opt.value ? 'bg-[#A8C300] text-white border-[#A8C300]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#A8C300]'
                          }`}>{t(`adCard.${opt.labelKey}`)}</button>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-sm px-2.5 py-1.5">
                      {t('adCard.nextRepostLabel')} <span className="font-semibold text-gray-700">{formatNextRepost(new Date(Date.now() + selectedInterval * 60000).toISOString(), true, t, i18n.language)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  {localAutoRepost && (
                    <button type="button" onClick={handleClearSchedule} disabled={isSavingSchedule}
                      className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-sm transition-colors">
                      {t('adCard.removeSchedule')}
                    </button>
                  )}
                  <button type="button" onClick={handleSaveSchedule} disabled={isSavingSchedule}
                    className="ml-auto px-3 py-1.5 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-300 text-white font-bold rounded-sm text-[11px] transition-colors">
                    {isSavingSchedule ? t('adCard.saving') : t('adCard.save')}
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
            title={aiBlocked ? t('adCard.aiOptLimitReached') : aiWarning ? t('adCard.aiOptNearLimit') : t('adCard.aiOpt')}
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
            <span>{t('adCard.aiOptShort')}</span>
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
            title={t('adCard.photoCheckTitle')}
            className="w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="shrink-0">📷</span>
            <span>{isLoadingPhotoFeedback ? t('adCard.photoCheckAnalyzing') : t('adCard.photoCheck')}</span>
          </button>

          {/* Vinted — gated behind feature flag */}
          {flags.enableVinted && (
            <div className="relative w-full group">
              <button
                disabled
                title={t('adCard.comingSoon')}
                className="w-full border border-gray-200 rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                <span>Vinted</span>
                <span>🚧</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                {t('adCard.comingSoon')}
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
                title={t('adCard.ebayComingSoon')}
                className="w-full border border-gray-200 rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                <span>eBay</span>
                <span>🚧</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                {t('adCard.ebayComingSoon')}
              </div>
            </div>
          )}

        </div>

        {/* Mobile Actions Collapsed Trigger */}
        <div className="flex md:hidden mt-auto w-full">
          <button
            onClick={() => setIsBottomSheetOpen(true)}
            className="w-full min-h-[44px] flex justify-center items-center gap-1.5 text-[13px] font-semibold text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-2 transition-colors"
          >
            {t('adCard.actions')}
          </button>
        </div>

      </div>

      {/* Expandable Analytics Panel — gated behind feature flag */}
      {showAnalytics && flags.enableAnalytics && (
        <div className="border-t border-ka-green/20 bg-green-50/40 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold text-ka-green uppercase tracking-wider">{t('adCard.repostPerformance')}</h3>
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
              { date: t('adCard.today'), views: 12, messages: 2, time: '14:30' },
              { date: t('adCard.yesterday'), views: 8, messages: 1, time: '10:15' },
              { date: t('adCard.daysAgo', { count: 2 }), views: 15, messages: 3, time: '09:00' },
            ].map((repost, idx) => (
              <div key={idx} className="bg-white rounded border border-ka-green/20 p-2 text-[11px]">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-800">{repost.date}</span>
                  <span className="text-gray-500 text-[10px]">{repost.time}</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-gray-500">{t('adCard.views')}</span>
                    <span className="font-bold text-ka-green ml-1">{repost.views}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('adCard.messages')}</span>
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
          <p className="text-[12px] text-gray-500">{t('adCard.analyticsDisabled')}</p>
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
              <h3 className="font-bold text-gray-800 text-[16px]">{t('adCard.adOptions')}</h3>
              <button
                onClick={() => setIsBottomSheetOpen(false)}
                className="p-3 -m-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
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
              <span>{t('adCard.startAiOpt')}</span>
            </button>

            {/* Photo Feedback — same handler as the desktop button, previously
                unreachable on mobile since this sheet didn't include it. */}
            <button
              onClick={async () => {
                setIsBottomSheetOpen(false);
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
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              <span>📷</span>
              <span>{isLoadingPhotoFeedback ? t('adCard.photoCheckAnalyzing') : t('adCard.photoCheck')}</span>
            </button>

            {/* Price Suggestion — same component as the desktop grid, previously
                unreachable on mobile. Same feature-flag/give-away gating. */}
            {flags.enablePriceSuggestion && !isGiveAwayAd(ad) && (
              <SuggestPriceButton ad={ad} size="lg" />
            )}

            {/* Vinted — coming soon */}
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 text-gray-400 bg-gray-50/50 cursor-not-allowed"
              title={t('adCard.comingSoon')}
            >
              <span>Vinted 🚧</span>
              <span className="text-xs font-normal">{t('adCard.comingSoonShort')}</span>
            </button>

            {/* eBay — coming soon */}
            <button
              disabled
              title={t('adCard.ebayComingSoon')}
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 border border-gray-200 text-gray-300 bg-gray-50/50 rounded-lg font-semibold text-sm cursor-not-allowed"
            >
              <EbayLogo />
              <span>eBay 🚧 <span className="text-xs font-normal">{t('adCard.comingSoonShort')}</span></span>
            </button>

            {/* Cancel Trigger */}
            <button
              onClick={() => setIsBottomSheetOpen(false)}
              className="w-full py-3 px-4 mt-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm transition-colors"
            >
              {t('adCard.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* eBay Cross-Post Confirmation Modal */}
      {showEbayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xxs">
          <div className="bg-white rounded-sm border border-gray-200 shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
              <EbayLogo /> {t('adCard.confirmEbayListing')}
            </h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-normal">
              {t('adCard.confirmEbayListingBefore')}{' '}
              <strong className="text-gray-800" dangerouslySetInnerHTML={{ __html: ad.title }} />{' '}
              {t('adCard.confirmEbayListingAfter')}
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2.5 text-[11px] text-blue-800 font-semibold mb-4 leading-relaxed">
              {t('adCard.ebayFixedPriceHint')}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEbayConfirm(false)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors"
              >
                {t('adCard.cancel')}
              </button>
              <button
                onClick={handleConfirmEbayCrossPost}
                className="px-3 py-1.5 text-[12px] font-bold bg-[#A8C300] hover:bg-[#96ae00] text-white rounded-sm transition-colors"
              >
                {t('adCard.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repost stats-loss warning — instant repost, or first-time schedule enable */}
      {confirmRepostAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xxs">
          <div className="bg-white rounded-sm border border-gray-200 shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> {t('adCard.confirmRepostTitle')}
            </h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-normal">
              {t('adCard.confirmRepostText')}
            </p>
            <div className="bg-orange-50 border border-orange-100 rounded-sm p-2.5 text-[12px] text-gray-700 mb-4 leading-relaxed">
              <div className="font-semibold text-gray-800 mb-1">{t('adCard.currentStats')}</div>
              <ul className="space-y-0.5">
                <li>- {statViews} {t('adCard.statViews')}</li>
                <li>- {statFavorites} {t('adCard.statFavorites')}</li>
                <li>- {statMessages} {t('adCard.statMessages')}</li>
              </ul>
            </div>
            <p className="text-[13px] text-gray-700 font-medium mb-4">{t('adCard.confirmRepostQuestion')}</p>
            <div className="flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => setConfirmRepostAction(null)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors"
              >
                {t('adCard.cancel')}
              </button>
              <button
                onClick={confirmRepostWarning}
                className="px-3 py-1.5 text-[12px] font-bold bg-[#A8C300] hover:bg-[#96ae00] text-white rounded-sm transition-colors"
              >
                {t('adCard.confirmRepostYes')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
