/**
 * Smart Repost — schedule reposts to land shortly before buyer browsing peaks and
 * apply one real micro-variation per refresh, respecting Kleinanzeigen's one-free-
 * refresh-per-7-days limit.
 *
 * IMPORTANT: this file is duplicated verbatim in extension/src/config/smart-repost.ts
 * (no shared package in the monorepo). Keep the two copies in sync — especially
 * PEAK_WINDOWS.
 */

/** Buyer browsing peaks, always in German local time (Europe/Berlin) — see
 *  getBerlinOffsetMinutes below for why this is pinned explicitly rather than
 *  using the runtime's local timezone. day: 0=Sun … 6=Sat. Easily editable. */
export interface PeakWindow {
  days: number[];
  startHour: number; // 24h Europe/Berlin
  label: string;
}

export const PEAK_WINDOWS: PeakWindow[] = [
  { days: [0], startHour: 19, label: 'So-Abend' },              // Sunday 19–22h
  { days: [1, 2, 3, 4, 5], startHour: 12, label: 'Mittag' },    // weekday lunch 12–14h
  { days: [1, 2, 3, 4, 5], startHour: 18, label: 'Abend' },     // weekday evening 18–21h
];

/** Kleinanzeigen allows one free refresh per listing per 7 days. */
export const SMART_MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** Post 30–60 min before the peak — 45 min lead. */
export const SMART_LEAD_MINUTES = 45;

/**
 * Europe/Berlin's UTC offset (in minutes) for a given UTC instant, via the
 * Intl API's real IANA tz database — correctly handles the CET/CEST DST
 * transition without any hardcoded date ranges. PEAK_WINDOWS' startHour is
 * meant as Germany's local hour; naively using Date.prototype.setHours
 * resolves in the RUNNING PROCESS's local timezone instead (whatever the
 * server's OS is set to, which is UTC by default on most VPS providers and
 * is never pinned anywhere in this repo's deployment config) — silently
 * shifting every Smart Repost by 1-2 hours from the intended peak. Probing
 * at noon UTC on the given date avoids ambiguity right at a DST transition
 * (which happens around 2-3am Berlin time, never at noon).
 */
function getBerlinOffsetMinutes(year: number, month0: number, day: number): number {
  const probeUtcMs = Date.UTC(year, month0, day, 12, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(probeUtcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour') === 24 ? 0 : get('hour'); // some locales report midnight as "24"
  const berlinAsUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'));
  return Math.round((berlinAsUtcMs - probeUtcMs) / 60_000);
}

/** UTC ms for a given Europe/Berlin wall-clock date + hour (minute=0). */
function berlinWallTimeToUtcMs(year: number, month0: number, day: number, hour: number): number {
  return Date.UTC(year, month0, day, hour, 0, 0) - getBerlinOffsetMinutes(year, month0, day) * 60_000;
}

/** Europe/Berlin calendar date (Y/M0/D) for a given UTC instant — needed so
 *  the scan below starts from the right calendar day even near midnight UTC,
 *  where Berlin's date can already be a day ahead. */
function getBerlinDateParts(ms: number): { year: number; month0: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month0: get('month') - 1, day: get('day') };
}

/**
 * Next smart repost time (ISO): the soonest peak-window start that is at least
 * 7 days after the last repost, minus the lead time. Falls back to the earliest
 * allowed time if no window is found in the scan horizon.
 */
export function computeNextSmartRepost(lastRepostAtMs: number | null, now: number = Date.now()): string {
  const leadMs = SMART_LEAD_MINUTES * 60_000;
  const earliest = Math.max(now, (lastRepostAtMs ?? 0) + SMART_MIN_INTERVAL_MS);

  const { year: baseYear, month0: baseMonth0, day: baseDay } = getBerlinDateParts(earliest);

  for (let d = 0; d < 21; d++) {
    const day = new Date(Date.UTC(baseYear, baseMonth0, baseDay + d));
    const year = day.getUTCFullYear();
    const month0 = day.getUTCMonth();
    const dayOfMonth = day.getUTCDate();
    const dow = day.getUTCDay();
    const starts = PEAK_WINDOWS
      .filter((w) => w.days.includes(dow))
      .map((w) => berlinWallTimeToUtcMs(year, month0, dayOfMonth, w.startHour))
      .sort((a, b) => a - b);
    for (const start of starts) {
      const repostAt = start - leadMs;
      if (repostAt >= earliest) return new Date(repostAt).toISOString();
    }
  }
  return new Date(earliest).toISOString();
}

/** Per-listing variation config (all optional). */
export interface SmartVariation {
  titleVariants?: string[];   // ≥2 to rotate the title
  rotatePhotos?: boolean;     // swap the first two photos
  priceStepPercent?: number;  // reduce price by this % each smart repost (default off)
}

export type VariationApplied = 'title' | 'photos' | 'price' | 'none';

/**
 * Return a COPY of adData with ONE micro-variation applied (rotating through the
 * enabled variations by repostCount), plus which one was applied. The repost
 * engine is unchanged — it just receives the varied data.
 */
export function applySmartVariation(
  adData: any,
  variation: SmartVariation | undefined | null,
  repostCount: number,
): { adData: any; applied: VariationApplied } {
  const enabled: Exclude<VariationApplied, 'none'>[] = [];
  if (variation?.titleVariants && variation.titleVariants.filter(Boolean).length >= 2) enabled.push('title');
  if (variation?.rotatePhotos) enabled.push('photos');
  if (variation?.priceStepPercent && variation.priceStepPercent > 0) enabled.push('price');
  if (enabled.length === 0) return { adData, applied: 'none' };

  const choice = enabled[repostCount % enabled.length];
  const out = { ...adData };

  if (choice === 'title') {
    const variants = variation!.titleVariants!.filter(Boolean);
    out.title = variants[repostCount % variants.length];
  } else if (choice === 'photos') {
    const pics = [...(adData.pictures || adData.images || [])];
    if (pics.length >= 2) { const t = pics[0]; pics[0] = pics[1]; pics[1] = t; }
    out.pictures = pics;
  } else if (choice === 'price') {
    const cur = typeof adData.price === 'number'
      ? adData.price
      : parseInt(String(adData.price ?? '').replace(/[^\d]/g, ''), 10) || 0;
    if (cur > 0) out.price = Math.max(1, Math.round(cur * (1 - variation!.priceStepPercent! / 100)));
  }
  return { adData: out, applied: choice };
}
