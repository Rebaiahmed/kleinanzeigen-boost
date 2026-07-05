/**
 * Smart Repost — schedule reposts to land shortly before buyer browsing peaks and
 * apply one real micro-variation per refresh, respecting Kleinanzeigen's one-free-
 * refresh-per-7-days limit.
 *
 * IMPORTANT: this file is duplicated verbatim in extension/src/config/smart-repost.ts
 * (no shared package in the monorepo). Keep the two copies in sync — especially
 * PEAK_WINDOWS.
 */

/** Buyer browsing peaks (local time). day: 0=Sun … 6=Sat. Easily editable. */
export interface PeakWindow {
  days: number[];
  startHour: number; // 24h local
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
 * Next smart repost time (ISO): the soonest peak-window start that is at least
 * 7 days after the last repost, minus the lead time. Falls back to the earliest
 * allowed time if no window is found in the scan horizon.
 */
export function computeNextSmartRepost(lastRepostAtMs: number | null, now: number = Date.now()): string {
  const leadMs = SMART_LEAD_MINUTES * 60_000;
  const earliest = Math.max(now, (lastRepostAtMs ?? 0) + SMART_MIN_INTERVAL_MS);

  for (let d = 0; d < 21; d++) {
    const day = new Date(earliest);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    const starts = PEAK_WINDOWS
      .filter((w) => w.days.includes(dow))
      .map((w) => { const t = new Date(day); t.setHours(w.startHour, 0, 0, 0); return t.getTime(); })
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
