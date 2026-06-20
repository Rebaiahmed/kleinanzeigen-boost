import { BrowserContext, Page, Response } from 'playwright';
import { getPersistentContext } from './browser-manager';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MY_ADS_URL = process.env.MARKETPLACE_MY_ADS_URL || 'https://www.kleinanzeigen.de/m-meine-anzeigen.html';
const CREATE_URL = 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper to mimic human latency
export const randomDelay = async (min = 1000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  await delay(ms);
};

// Add jitter to avoid predictable patterns that trigger IP blocks.
export const randomJitter = async (chance = 0.3) => {
  if (Math.random() < chance) {
    const jitterMs = Math.floor(Math.random() * 3000) + 2000;
    console.log(`[repost] ⏱ jitter pause: ${jitterMs}ms`);
    await delay(jitterMs);
  }
};

/** Compact one-line response info. */
function formatResponseDiagnostics(response: Response | null | undefined, pageUrl: string): string {
  if (!response) return `(no response) url=${pageUrl}`;
  return `status=${response.status()} url=${response.url()}`;
}

/**
 * Full diagnostic dump (status/headers/body/UA/cookies/classification). Kept from
 * the 403 diagnosis — still useful to capture any future block. Logging only.
 */
async function captureFullDiagnostics(
  context: BrowserContext,
  page: Page,
  response: Response | null | undefined,
  step: string,
  label: string,
): Promise<void> {
  const out: string[] = [];
  out.push(`\n===== [repost-diag] ${label} | step=${step} =====`);
  let navUA = 'n/a';
  try { navUA = await page.evaluate(() => navigator.userAgent); } catch { /* gone */ }
  out.push(`navigator.userAgent  = ${navUA}`);
  out.push(`looksHeadless        = ${/HeadlessChrome|Headless/i.test(navUA)}`);
  if (response) {
    const req = response.request();
    out.push(`request.method       = ${req.method()}`);
    out.push(`request.url          = ${req.url()}`);
    out.push(`request.UA header    = ${req.headers()['user-agent'] || 'n/a'}`);
    out.push(`response.status      = ${response.status()} ${response.statusText()}`);
    out.push(`response.url (final) = ${response.url()}`);
    try { out.push(`response.headers     = ${JSON.stringify(response.headers())}`); } catch { /* noop */ }
    let body = '';
    try { body = await response.text(); } catch { try { body = (await page.content()) || ''; } catch { /* noop */ } }
    const bodyFlat = (body || '').replace(/\s+/g, ' ').trim();
    out.push(`response.body[0..1000]= ${bodyFlat.slice(0, 1000)}`);
  } else {
    out.push(`(no response object) page.url = ${page.url()}`);
  }
  try {
    const cookies = await context.cookies();
    const names = cookies.map((c) => c.name);
    out.push(`context.cookies.count= ${cookies.length}  has access_token=${names.includes('access_token')}`);
  } catch { /* noop */ }
  out.push(`===== end ${label} =====\n`);
  console.log(out.join('\n'));
}

// ─── Original-ad scrape (mirrors the extension's fetchOriginalAdData) ──────────

interface ScrapedAd {
  description?: string;
  priceType?: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY';
  categoryPath?: string; // "parent/leaf"
  attributes?: Record<string, string>;
  pictures?: string[];
}

async function fetchOriginalAdData(page: Page, adId: string): Promise<ScrapedAd> {
  await page.goto(`https://www.kleinanzeigen.de/s-anzeige/${adId}`, { waitUntil: 'domcontentloaded' });
  await delay(1500);
  return await page.evaluate(() => {
    const norm = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim();

    const descEl = document.querySelector('p#viewad-description-text');
    const description = descEl ? norm(descEl.textContent).slice(0, 2000) : undefined;

    const priceTxt = norm((document.querySelector('#viewad-price') as HTMLElement | null)?.textContent || '');
    let priceType: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY' | undefined;
    if (/verschenken/i.test(priceTxt)) priceType = 'GIVE_AWAY';
    else if (/\bVB\b/.test(priceTxt)) priceType = 'NEGOTIABLE';
    else if (/\d/.test(priceTxt)) priceType = 'FIXED';

    let categoryPath: string | undefined;
    const crumb = document.querySelector('#vap-brdcrmb');
    if (crumb) {
      const ids: string[] = [];
      crumb.querySelectorAll('a').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/\/c(\d+)/);
        if (m) ids.push(m[1]);
      });
      if (ids.length >= 2) categoryPath = ids[ids.length - 2] + '/' + ids[ids.length - 1];
      else if (ids.length === 1) categoryPath = ids[0];
    }

    const attributes: Record<string, string> = {};
    document.querySelectorAll('#viewad-details .addetailslist--detail').forEach((item) => {
      const v = item.querySelector('.addetailslist--detail--value');
      if (!v) return;
      const value = norm(v.textContent);
      const full = norm(item.textContent);
      const label = (value && full.endsWith(value) ? full.slice(0, full.length - value.length) : full).trim();
      if (label && value) attributes[label] = value;
    });

    const photos: string[] = [];
    document.querySelectorAll('img[data-imgsrc]').forEach((img) => {
      const s = img.getAttribute('data-imgsrc');
      if (s && s.includes('img.kleinanzeigen.de')) photos.push(s);
    });

    return { description, priceType, categoryPath, attributes, pictures: Array.from(new Set(photos)).slice(0, 3) };
  });
}

// ─── Form helpers (mirror the extension engine, in Playwright/page.evaluate) ───

async function fillField(page: Page, selector: string, value: string): Promise<boolean> {
  return await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return false;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    return true;
  }, { sel: selector, val: value });
}

async function setPriceType(page: Page, priceType: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY'): Promise<boolean> {
  const labelMap = { FIXED: 'Festpreis', NEGOTIABLE: 'VB', GIVE_AWAY: 'Zu verschenken' };
  const optionText = labelMap[priceType];
  return await page.evaluate(async (text) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const btn = document.querySelector('button#ad-price-type') as HTMLElement | null;
    if (!btn) return false;
    btn.click();
    await sleep(400);
    const items = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li'));
    const opt = items.find((el) => (el.textContent || '').trim() === text) as HTMLElement | undefined;
    if (!opt) return false;
    opt.click();
    await sleep(300);
    const input = document.querySelector('input[name="priceType"]') as HTMLInputElement | null;
    if (input) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }, optionText);
}

async function setShipping(page: Page, type: 'ja' | 'nein' = 'ja'): Promise<boolean> {
  const targetId = type === 'ja' ? 'ad-shipping-enabled-yes' : 'ad-shipping-enabled-no';
  return await page.evaluate((id) => {
    const i = document.querySelector('#' + id) as HTMLInputElement | null;
    if (!i) return false;
    i.click();
    return !!i.checked;
  }, targetId);
}

/** Category select: open picker → click parent (cat_ID) → first leaf → Weiter. */
async function setCategory(page: Page, categoryId: string): Promise<boolean> {
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('a, button, div[role="button"]'))
      .find((el) => (el.textContent || '').trim().includes('Kategorie')) as HTMLElement | undefined;
    if (t) t.click();
  });
  await delay(1500);
  const parentOk = await page.evaluate((id) => {
    const l = document.querySelector('a#cat_' + id) as HTMLElement | null;
    if (!l) return false;
    l.click();
    return true;
  }, categoryId);
  if (!parentOk) { console.warn(`[repost] category parent cat_${categoryId} not found`); return false; }
  await delay(1000);
  await page.evaluate(() => {
    const leaf = document.querySelector('li.category-selection-list-item.is-leaf a') as HTMLElement | null;
    if (leaf) leaf.click();
  });
  await delay(1000);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').trim() === 'Weiter') as HTMLElement | undefined;
    if (b) b.click();
  });
  const back = await page.waitForSelector('input#ad-title', { timeout: 15000 }).then(() => true).catch(() => false);
  return back;
}

/** Replay captured attributes — combobox / Zustand modal / select / input. */
async function fillDynamicAttributes(page: Page, attributes: Record<string, string>): Promise<{ filled: string[]; skipped: string[]; failed: string[] }> {
  return await page.evaluate(async (attrs) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const norm = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const KEY_MAP: Record<string, string> = {
      'farbe': 'color', 'material': 'material', 'zustand': 'condition', 'art': 'art',
      'größe': 'size', 'groesse': 'size', 'grösse': 'size', 'marke': 'brand', 'typ': 'type',
    };
    const summary = { filled: [] as string[], skipped: [] as string[], failed: [] as string[] };

    for (const [label, value] of Object.entries(attrs)) {
      const want = norm(label);
      const wantVal = norm(value);
      if (!want) { summary.skipped.push(label); continue; }

      const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];
      const lblEl = labels.find((l) => norm(l.textContent) === want)
        || labels.find((l) => norm(l.textContent).replace(/\*$/, '').trim() === want)
        || labels.find((l) => norm(l.textContent).startsWith(want));

      let ctrl: any = null;
      let forId: string | null = lblEl ? lblEl.getAttribute('for') : null;
      if (lblEl) {
        if (forId) ctrl = document.getElementById(forId);
        if (!ctrl) {
          const scope = (lblEl.closest('div,fieldset,section') || document) as ParentNode;
          ctrl = scope.querySelector('button[role="combobox"], button[aria-haspopup], select, input:not([type="hidden"]), textarea');
        }
      }
      if (!ctrl) {
        const key = KEY_MAP[want];
        if (key) {
          const cands = Array.from(document.querySelectorAll('[id$=".' + key + '"], [name$=".' + key + ']"], [name*="[' + key + ']"]')) as HTMLElement[];
          ctrl = cands.find((c) => {
            const t = c.tagName.toLowerCase(); const ty = (c.getAttribute('type') || '').toLowerCase();
            return t === 'button' || t === 'select' || t === 'textarea' || (t === 'input' && ty !== 'hidden');
          }) || null;
          if (!ctrl && cands.length) {
            const hidden = cands[0]; forId = hidden.id || forId;
            const scope = (hidden.closest('div,fieldset,section') || document) as ParentNode;
            ctrl = scope.querySelector('button[role="combobox"], button[aria-haspopup], select');
          }
        }
      }
      if (!ctrl) { summary.skipped.push(label); continue; }

      const tag = (ctrl.tagName || '').toLowerCase();
      const role = (ctrl.getAttribute && (ctrl.getAttribute('role') || '')).toLowerCase();
      const haspopup = (ctrl.getAttribute && (ctrl.getAttribute('aria-haspopup') || '')).toLowerCase();
      const isCondition = haspopup === 'dialog' || (forId && /\.condition/i.test(forId)) || want === 'zustand';

      try {
        if (isCondition) {
          let trigger: any = (tag === 'button' && haspopup === 'dialog') ? ctrl : null;
          if (!trigger) {
            for (const l of labels.filter((x) => norm(x.textContent).startsWith('zustand') || /\.condition/i.test(x.getAttribute('for') || ''))) {
              const scope = (l.closest('div,fieldset,section') || document) as ParentNode;
              const b = scope.querySelector('button[aria-haspopup="dialog"], button[aria-haspopup="true"]');
              if (b) { trigger = b; break; }
            }
          }
          if (!trigger) trigger = document.querySelector('button[aria-haspopup="dialog"]');
          if (!trigger) { summary.failed.push(label); continue; }
          trigger.click();
          let dlg: Element | null = null;
          for (let i = 0; i < 25; i++) { await sleep(150); dlg = document.querySelector('[role="dialog"], dialog[open]'); if (dlg) break; }
          if (!dlg) { summary.failed.push(label); continue; }
          const opts = Array.from(dlg.querySelectorAll('label, [role="radio"], [role="option"], button, li')) as HTMLElement[];
          const opt = opts.find((o) => norm(o.textContent) === wantVal) || opts.find((o) => norm(o.textContent).includes(wantVal));
          if (!opt) { summary.failed.push(label); continue; }
          opt.click(); await sleep(200);
          const confirm = (Array.from(dlg.querySelectorAll('button')) as HTMLElement[]).find((b) => norm(b.textContent).includes('bestätigen') || norm(b.textContent).includes('bestatigen'));
          if (confirm) confirm.click();
          for (let i = 0; i < 25; i++) { await sleep(150); if (!document.querySelector('[role="dialog"], dialog[open]')) break; }
          summary.filled.push(label); continue;
        }

        if (tag === 'button' && (role === 'combobox' || haspopup === 'listbox' || haspopup === 'true' || haspopup === 'menu')) {
          ctrl.click();
          let opts: HTMLElement[] = [];
          for (let i = 0; i < 25; i++) { await sleep(120); opts = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] li')) as HTMLElement[]; if (opts.length) break; }
          if (!opts.length) opts = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li')) as HTMLElement[];
          const opt = opts.find((o) => norm(o.textContent) === wantVal) || opts.find((o) => norm(o.textContent).includes(wantVal));
          if (!opt) { try { ctrl.click(); } catch { /* close */ } summary.failed.push(label); continue; }
          opt.click(); await sleep(150);
          summary.filled.push(label); continue;
        }

        if (tag === 'select') {
          const options = Array.from((ctrl as HTMLSelectElement).options);
          const opt = options.find((o) => norm(o.textContent) === wantVal) || options.find((o) => norm(o.textContent).includes(wantVal));
          if (!opt) { summary.failed.push(label); continue; }
          (ctrl as HTMLSelectElement).value = opt.value;
          ctrl.dispatchEvent(new Event('input', { bubbles: true }));
          ctrl.dispatchEvent(new Event('change', { bubbles: true }));
          summary.filled.push(label); continue;
        }

        if (tag === 'input' || tag === 'textarea') {
          (ctrl as HTMLInputElement).value = value;
          ctrl.dispatchEvent(new Event('input', { bubbles: true }));
          ctrl.dispatchEvent(new Event('change', { bubbles: true }));
          ctrl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          summary.filled.push(label); continue;
        }

        summary.skipped.push(label);
      } catch {
        summary.failed.push(label);
      }
    }
    return summary;
  }, attributes);
}

// ─── Photos: download server-side, then native setInputFiles ──────────────────

async function downloadPhotos(urls: string[]): Promise<string[]> {
  const files: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const resp = await axios.get(urls[i], { responseType: 'arraybuffer', timeout: 20000 });
      const fp = path.join(os.tmpdir(), `ab-photo-${Date.now()}-${i}.jpg`);
      fs.writeFileSync(fp, Buffer.from(resp.data));
      files.push(fp);
    } catch (e: any) {
      console.warn(`[repost] photo download failed (${urls[i]}): ${e.message}`);
    }
  }
  return files;
}

async function uploadPhotos(page: Page, files: string[]): Promise<boolean> {
  if (files.length === 0) return true;
  try {
    const input = page.locator('input[type="file"][multiple]').first();
    await input.setInputFiles(files, { timeout: 15000 });
    await delay(1500);
    return true;
  } catch (e: any) {
    // Fallback to any file input.
    try {
      await page.locator('input[type="file"]').first().setInputFiles(files, { timeout: 15000 });
      await delay(1500);
      return true;
    } catch (e2: any) {
      console.warn(`[repost] photo upload failed: ${e2.message}`);
      return false;
    }
  } finally {
    for (const f of files) { try { fs.unlinkSync(f); } catch { /* noop */ } }
  }
}

async function submitForm(page: Page): Promise<boolean> {
  const clickInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((x) => (x.textContent || '').toLowerCase().includes('aufgeben')) as HTMLButtonElement | undefined;
    if (!btn) return { clicked: false, reason: 'no_button', buttons: btns.map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10) };
    try { btn.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
    const disabled = btn.disabled;
    btn.click();
    return { clicked: true, disabled, text: (btn.textContent || '').trim() };
  });
  console.log(`[repost] submit click: ${JSON.stringify(clickInfo)}`);

  for (let i = 0; i < 24; i++) {
    await delay(500);
    const url = page.url();
    if (url.includes('bestaetigung')) return true;
    if (url.includes('fehler') || url.includes('error')) { console.error(`[repost] submit → error page: ${url}`); return false; }
  }

  // Still on the form → capture the validation errors so we know which required
  // field blocked the submit (location/PLZ, a required attribute like "Art", etc.).
  const diag = await page.evaluate(() => {
    const errs: string[] = [];
    const sel = '[class*="error" i], [class*="Error"], [role="alert"], .Indicator--negative, [data-testid*="error"], .formgroup--error, .error-message';
    document.querySelectorAll(sel).forEach((e) => {
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length > 1 && t.length < 200) errs.push(t);
    });
    // Key required fields' current values, to spot an empty one.
    const val = (s: string) => (document.querySelector(s) as HTMLInputElement | null)?.value ?? '(missing)';
    return {
      errors: Array.from(new Set(errs)).slice(0, 25),
      fields: {
        title: val('input#ad-title'),
        price: val('input#ad-price-amount'),
        plz: val('input#postad-zip, input[name="zipCode"], #pstad-zip'),
        category: val('input[name="categoryId"]'),
        priceType: val('input[name="priceType"]'),
      },
    };
  });
  console.error(`[repost] submit NOT confirmed — validation diag: ${JSON.stringify(diag)}`);
  return false;
}

// ─── Delete the OLD ad AFTER a successful publish (best-effort, non-fatal) ─────

async function deleteOldAd(page: Page, adId: string): Promise<boolean> {
  try {
    await page.goto(`${MY_ADS_URL}?tab=PROJECTS`, { waitUntil: 'domcontentloaded' });
    await randomDelay(1500, 3000);
    const adCard = page.locator(`[data-id="${adId}"], [data-adid="${adId}"], [data-ad-id="${adId}"]`).first();
    if (!(await adCard.isVisible().catch(() => false))) {
      console.warn(`[repost] delete: old ad ${adId} not visible in My Ads (already gone?)`);
      return false;
    }
    const delBtn = adCard.locator('button', { has: page.locator('svg[aria-label*="löschen"], svg[aria-label*="delete"]') }).first();
    if (!(await delBtn.isVisible().catch(() => false))) {
      console.warn('[repost] delete: delete button not found in ad card');
      return false;
    }
    await delBtn.click();
    await randomDelay(800, 1500);
    const confirm = page.locator('button:has-text("Ja, löschen"), button:has-text("Confirm"), button[aria-label*="confirm delete"]').first();
    if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirm.click();
      await randomDelay(1500, 3000);
    }
    console.log(`[repost] ✓ old ad ${adId} deleted`);
    return true;
  } catch (e: any) {
    console.warn(`[repost] delete old ad failed (non-fatal): ${e.message}`);
    return false;
  }
}

// ─── Main flow: create-first (mirrors the extension engine), delete-after ─────

export async function executeRepostFlow(userId: string, adId: string, adData: any, cookies?: any[]): Promise<{ success: boolean; step: string; error?: string }> {
  let page: Page | null = null;
  let currentStep = 'init';
  console.log(`[repost] ▶ start ad=${adId} user=${userId} cookies=${Array.isArray(cookies) ? cookies.length : 0}`);

  try {
    const context = await getPersistentContext(userId);

    if (Array.isArray(cookies) && cookies.length > 0) {
      const validSameSite = ['Strict', 'Lax', 'None'];
      const sanitized = cookies.map((c: any) => ({ ...c, sameSite: validSameSite.includes(c.sameSite) ? c.sameSite : 'Lax' }));
      console.log(`[repost] Injecting ${sanitized.length} cookies: ${sanitized.map((c: any) => c.name).join(', ')}`);
      await context.addCookies(sanitized);
    } else {
      console.warn('[repost] ⚠ NO COOKIES provided — will likely fail auth');
    }

    for (const existing of context.pages()) {
      if (existing.url() !== 'about:blank') await existing.close().catch(() => {});
    }
    page = await context.newPage();

    // Session check (also the isolation test for any block).
    currentStep = 'session_check';
    const sessResp = await page.goto(MY_ADS_URL, { waitUntil: 'domcontentloaded' });
    console.log(`[repost] session_check: ${formatResponseDiagnostics(sessResp, page.url())}`);
    if (sessResp?.status() === 403) {
      await captureFullDiagnostics(context, page, sessResp, currentStep, '403 AT SESSION_CHECK');
      // Distinguish a temporary IP-range ban ("IP-Bereich … gesperrt") from a
      // generic 403 so the scheduler classifies it as IP_BLOCKED and backs off
      // (instead of hammering the already-blocked IP every minute).
      const body = ((await page.textContent('body').catch(() => '')) || '');
      if (/IP-Bereich|gesperrt|ungewöhnliche aktivität|unusual activity|too many requests/i.test(body)) {
        throw new Error('IP_BLOCKED — Kleinanzeigen IP-range temporarily blocked (gesperrt).');
      }
      throw new Error('403_FORBIDDEN — session/IP rejected.');
    }
    if (page.url().includes('login') || sessResp?.status() === 401) {
      throw new Error('SESSION_EXPIRED — redirected to login. Please reconnect on the dashboard.');
    }

    // Scrape the original ad (description / photos / priceType / category / attributes).
    currentStep = 'scrape_original';
    const scraped = await fetchOriginalAdData(page, adId);
    console.log(`[repost] scraped: category=${scraped.categoryPath} priceType=${scraped.priceType} photos=${scraped.pictures?.length || 0} attrs=${JSON.stringify(scraped.attributes || {})}`);

    const merged = {
      title: adData?.title,
      price: adData?.price,
      description: adData?.description || scraped.description,
      priceType: scraped.priceType,
      categoryPath: scraped.categoryPath,
      attributes: scraped.attributes || {},
      pictures: (adData?.pictures && adData.pictures.length ? adData.pictures : scraped.pictures) || [],
    };

    // Pre-download photos before touching the form.
    currentStep = 'download_photos';
    const photoFiles = await downloadPhotos(merged.pictures);
    console.log(`[repost] downloaded ${photoFiles.length}/${merged.pictures.length} photos`);

    // Open the create form.
    currentStep = 'open_create_form';
    const createResp = await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });
    if (createResp?.status() === 403) {
      await captureFullDiagnostics(context, page, createResp, currentStep, '403 AT CREATE PAGE');
      throw new Error('403_FORBIDDEN at create page');
    }
    if (!(await page.waitForSelector('input#ad-title', { timeout: 15000 }).then(() => true).catch(() => false))) {
      throw new Error('FORM_NOT_FOUND — create form did not render');
    }

    // 1) Category FIRST (renders category-specific fields). Use L1 id from the path.
    currentStep = 'set_category';
    const l1 = merged.categoryPath ? merged.categoryPath.split('/')[0] : (adData?.l1Category || '');
    if (l1) {
      const catOk = await setCategory(page, l1);
      if (!catOk) console.warn('[repost] ⚠ category selection failed — continuing with auto-detected category');
      await delay(1000);
    }

    // 2) Dynamic attributes.
    currentStep = 'fill_attributes';
    if (Object.keys(merged.attributes).length > 0) {
      const sum = await fillDynamicAttributes(page, merged.attributes);
      console.log(`[repost] attributes summary: ${JSON.stringify(sum)}`);
    }

    // 3) Photos.
    currentStep = 'upload_photos';
    if (photoFiles.length > 0) await uploadPhotos(page, photoFiles);

    // 4) Price type (numeric price wins over scraped type).
    currentStep = 'set_price_type';
    const priceNum = typeof merged.price === 'string' ? (parseInt(String(merged.price).replace(/[^\d]/g, ''), 10) || 0) : (merged.price ?? 0);
    let priceType: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY' = 'FIXED';
    if (priceNum > 0) priceType = merged.priceType === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
    else if (merged.priceType === 'GIVE_AWAY' || priceNum === 0) priceType = 'GIVE_AWAY';
    await setPriceType(page, priceType);
    await delay(400);

    // 5) Description + price.
    currentStep = 'fill_fields';
    if (merged.description) await fillField(page, 'textarea#ad-description', merged.description);
    if (merged.price != null) await fillField(page, 'input#ad-price-amount', String(merged.price));
    await delay(400);

    // 6) Shipping.
    currentStep = 'set_shipping';
    await setShipping(page, 'ja');
    await delay(400);

    // 7) Title — deferred to just before submit (prevents React re-render clearing it).
    currentStep = 'set_title';
    if (merged.title) await fillField(page, 'input#ad-title', merged.title);
    await delay(400);

    // 8) Submit.
    currentStep = 'submit';
    const submitted = await submitForm(page);
    if (!submitted) throw new Error('SUBMIT_NOT_CONFIRMED — no confirmation page after submit');
    console.log(`[repost] ✓ published — ${page.url()}`);

    // 9) Delete the OLD ad AFTER a confirmed publish (best-effort, non-fatal).
    currentStep = 'delete_old_ad';
    await deleteOldAd(page, adId);

    await page.close().catch(() => {});
    return { success: true, step: 'submitted' };
  } catch (error: any) {
    const url = page ? page.url() : 'n/a';
    const errorMsg = error?.message || 'Unknown error';
    console.error(`[repost] ✗ FAILED at step='${currentStep}' ad=${adId} url=${url}: ${errorMsg}`);
    if (page) {
      try {
        const bodyText = await page.textContent('body');
        if (bodyText) console.error(`[repost] Page body (first 600 chars): ${bodyText.replace(/\s+/g, ' ').slice(0, 600)}`);
      } catch { /* noop */ }
      await page.close().catch(() => {});
    }
    return { success: false, step: currentStep, error: errorMsg };
  }
}
