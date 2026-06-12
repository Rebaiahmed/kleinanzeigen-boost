import { Page } from 'playwright';
import { getPersistentContext } from './browser-manager';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const EDIT_URL = (adId: string) => `https://www.kleinanzeigen.de/p-anzeige-bearbeiten.html?adId=${adId}`;
const DETAIL_URL = (adId: string) => `https://www.kleinanzeigen.de/s-anzeige/${adId}`;

export interface AdSnapshot {
  adId: string;
  title: string;
  description: string;
  priceAmount: string;
  priceType: string;
  categoryId: string;
  locationId: string;
  zipCode: string;
  adType: string;
  photoUrls: string[];
  photoFiles: string[]; // local temp paths of downloaded full-size photos
}

function sanitizeCookies(cookies: any[]) {
  const valid = ['Strict', 'Lax', 'None'];
  return cookies.map((c: any) => ({ ...c, sameSite: valid.includes(c.sameSite) ? c.sameSite : 'Lax' }));
}

/** Read a form input's value if present, else ''. Never throws. */
async function val(page: Page, selector: string): Promise<string> {
  try {
    const el = page.locator(selector).first();
    if (await el.count()) return (await el.inputValue().catch(() => '')) || (await el.getAttribute('value').catch(() => '')) || '';
  } catch { /* ignore */ }
  return '';
}

/**
 * NON-DESTRUCTIVE: capture everything needed to re-create the ad.
 * Reads fields from the edit page (same form as the post page, pre-filled) and
 * downloads all full-size photos from the public detail page. Deletes nothing.
 */
export async function captureAdSnapshot(userId: string, adId: string, cookies?: any[]): Promise<{ success: boolean; snapshot?: AdSnapshot; step: string; error?: string }> {
  let page: Page | null = null;
  let step = 'init';
  console.log(`[snapshot] ▶ start ad=${adId} user=${userId} cookies=${Array.isArray(cookies) ? cookies.length : 0}`);

  try {
    const context = await getPersistentContext(userId);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(sanitizeCookies(cookies));
    }
    page = await context.newPage();

    // ── 1. Fields from the edit page ───────────────────────────────────────
    step = 'load_edit';
    const resp = await page.goto(EDIT_URL(adId), { waitUntil: 'domcontentloaded' });
    if (page.url().includes('login') || resp?.status() === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    // Give the React form a moment to hydrate the pre-filled values.
    await page.waitForSelector('#ad-title', { timeout: 15000 }).catch(() => {});

    step = 'read_fields';
    const snapshot: AdSnapshot = {
      adId,
      title: await val(page, '#ad-title'),
      description: await val(page, '#ad-description'),
      priceAmount: await val(page, '#ad-price-amount'),
      priceType: await val(page, 'input[name="priceType"]'),
      categoryId: await val(page, 'input[name="categoryId"]'),
      locationId: await val(page, 'input[name="locationId"]'),
      zipCode: await val(page, '#ad-zip-code'),
      adType: (await page.locator('input[name="adType"]:checked').first().getAttribute('value').catch(() => '')) || 'OFFER',
      photoUrls: [],
      photoFiles: [],
    };
    console.log(`[snapshot] fields → title="${snapshot.title}" price=${snapshot.priceAmount} type=${snapshot.priceType} cat=${snapshot.categoryId} loc=${snapshot.locationId}`);

    // ── 2. Photo URLs from the public detail page ──────────────────────────
    step = 'read_photos';
    await page.goto(DETAIL_URL(adId), { waitUntil: 'domcontentloaded' });
    const rawUrls: string[] = await page.$$eval(
      'img[src*="img.kleinanzeigen.de/api/v1/prod-ads/images"]',
      (imgs) => imgs.map((i) => (i as HTMLImageElement).src),
    ).catch(() => []);

    // Dedupe by the image UUID and request the largest variant (rule=$_57.JPG).
    const byId = new Map<string, string>();
    for (const u of rawUrls) {
      const m = u.match(/images\/[^?]+/);
      if (!m) continue;
      const full = `https://img.kleinanzeigen.de/api/v1/prod-ads/${m[0].replace(/^.*prod-ads\//, '')}`;
      const base = full.split('?')[0];
      byId.set(base, `${base}?rule=$_57.JPG`);
    }
    snapshot.photoUrls = [...byId.values()];
    console.log(`[snapshot] found ${snapshot.photoUrls.length} photo(s)`);

    // ── 3. Download photos to a temp dir ───────────────────────────────────
    step = 'download_photos';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ab-snap-${adId}-`));
    let idx = 0;
    for (const url of snapshot.photoUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) { console.warn(`[snapshot] photo ${idx} HTTP ${res.status}`); idx++; continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const file = path.join(dir, `photo-${idx}.jpg`);
        fs.writeFileSync(file, buf);
        snapshot.photoFiles.push(file);
        console.log(`[snapshot] downloaded photo ${idx} (${buf.length} bytes)`);
      } catch (e: any) {
        console.warn(`[snapshot] photo ${idx} download failed: ${e.message}`);
      }
      idx++;
    }

    await page.close().catch(() => {});
    console.log(`[snapshot] ✓ done ad=${adId} fields ok, ${snapshot.photoFiles.length}/${snapshot.photoUrls.length} photos saved to ${dir}`);
    return { success: true, snapshot, step };
  } catch (error: any) {
    console.error(`[snapshot] ✗ FAILED at step='${step}' ad=${adId} → ${error?.message}`);
    if (error?.stack) console.error(error.stack);
    if (page) await page.close().catch(() => {});
    return { success: false, step, error: error.message || 'snapshot failed' };
  }
}
