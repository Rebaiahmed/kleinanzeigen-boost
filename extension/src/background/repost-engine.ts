/**
 * Client-side repost engine — full automation in the user's own tab.
 *
 * Transport: chrome.scripting.executeScript({ world: 'MAIN' }). We deliberately
 * do NOT use chrome.debugger / CDP, so Chrome never shows the alarming
 * "started debugging this browser" banner. MAIN-world injection runs in the
 * page realm (required for the file-input upload trick and for React events).
 *
 * Flow: fetch original ad data → open create form → category first → upload
 * photos → fill fields → title (deferred) → submit. A branded full-screen
 * overlay (see src/content/overlay.ts) covers every page so the user never
 * sees a half-loaded Kleinanzeigen page.
 */

interface AdData {
  id: string;
  title: string;
  description: string;
  price: number | string;
  priceType?: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY';
  imageCount?: number;
  l1Category?: string; // numeric ID like "80"
  l1CategoryName?: string;
  categoryPath?: string; // numeric path "parent/leaf" scraped from the original ad, e.g. "80/88"
  pictures?: string[];
  attributes?: Record<string, string>; // category-specific, e.g. { "Farbe": "Schwarz", "Material": "Holz", "Zustand": "Gut" }
}

type StatusPhase = 'working' | 'done' | 'error';

function log(...a: any[]) { console.log('[AB-repost]', ...a); }
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip JSON/serialization artifacts (wrapping quotes, trailing `",` or `,`)
 *  that can leak into stored title/description values, leaving plain text. */
function cleanText(s: string | undefined | null): string {
  return (s || '')
    .trim()
    .replace(/^["']+/, '')          // leading quotes
    .replace(/["']\s*,?\s*$/, '')   // trailing quote (+ optional comma)
    .replace(/,\s*$/, '')           // bare trailing comma
    .trim();
}

// Kleinanzeigen's title field cap — same "60" assumption used consistently
// across the UI counter (CreateWithAi.tsx) and the AI prompt
// (analyze-photos.system.txt), not independently re-verified against
// Kleinanzeigen's own documented limit. fillField below assigns via the
// native React value-setter, which bypasses the KA form's own HTML
// `maxlength` attribute (that only constrains user keystrokes, not
// scripted .value assignment) — so if the AI ever returns a longer title
// despite its instructions, this is the last line of defense before it's
// written into the live form.
const KA_TITLE_MAX_CHARS = 60;

// ─── MAIN-world execution primitives ──────────────────────────────────────────

/** Run a self-contained function in the page's MAIN world; return its result.
 *  executeScript awaits a returned Promise, so injected funcs may be async. */
async function runMain<R>(tabId: number, func: (...a: any[]) => R | Promise<R>, args: any[] = []): Promise<R | undefined> {
  const res = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: func as any,
    args,
  });
  return res?.[0]?.result as R;
}

/** Navigate the tab (in-page) and wait until the new document is ready. */
async function navigate(tabId: number, url: string): Promise<void> {
  try { await runMain(tabId, (u: string) => { window.location.assign(u); }, [url]); } catch { /* page tears down */ }
  await waitForReady(tabId);
  await delay(600); // small settle for late scripts
}

/** Poll document.readyState until 'complete' (tolerates navigation errors). */
async function waitForReady(tabId: number): Promise<void> {
  for (let i = 0; i < 80; i++) {
    await delay(300);
    try {
      const rs = await runMain<string>(tabId, () => document.readyState, []);
      if (rs === 'complete') return;
    } catch { /* mid-navigation */ }
  }
}

/** Wait for a selector to exist in the DOM. */
async function waitForElement(tabId: number, selector: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await runMain<boolean>(tabId, (s: string) => !!document.querySelector(s), [selector]);
      if (ok) return true;
    } catch { /* mid-navigation */ }
    await delay(300);
  }
  return false;
}

/**
 * Detects a Kleinanzeigen login-wall redirect. When the session is expired,
 * navigating to a form/action page redirects to m-einloggen.html instead of
 * rendering the expected form — the caller would otherwise see a generic
 * "element not found" timeout with no indication the session died. Checked
 * via the tab's actual URL (not DOM content) since the login page's markup
 * isn't otherwise inspected here.
 */
async function isOnLoginPage(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return !!tab.url && /m-einloggen\.html/i.test(tab.url);
  } catch {
    return false;
  }
}

// ─── DEV-only debug mode ──────────────────────────────────────────────────────
// OFF in production. There is NO user-facing toggle and the production caller
// never passes debug:true, so a shipped build always runs debug = false (no
// highlighting, no pauses, no per-field widget — and it DOES submit). To watch
// the repost fill in real time, a developer flips REPOST_DEBUG to true (or
// passes debug:true to executeRepostFullFlow) and rebuilds.
const REPOST_DEBUG = false;          // dev switch — must be false in shipped builds
const DEBUG_DELAY_SCALE = 3;         // slow the flow ×3 when debugging
const DEBUG_HIGHLIGHT_MS = 500;      // outline pause before each interaction

// Per-flow timing scale: 1 normally, DEBUG_DELAY_SCALE in debug.
let DELAY_SCALE = 1;
const wait = (ms: number) => delay(ms * DELAY_SCALE);

// ─── Status overlay ───────────────────────────────────────────────────────────
// Normal mode: full-screen branded cover (hides the half-loaded KA form — clean
// UX). Debug mode: a SMALL, non-blocking bottom-right widget with a live per-
// field log, leaving the form fully visible so each highlight + fill is watchable.
// The painter is auto-run at document_start on every navigation by the registered
// content script (src/content/overlay.ts), which mirrors this exact render.

interface RepostStatus { message: string; phase: StatusPhase; debug: boolean; log: string[]; }
const statusByTab = new Map<number, RepostStatus>();

/** Self-contained painter (no closure refs) — mirrored in src/content/overlay.ts.
 *  Writes the status to sessionStorage (so it survives navigation) and renders. */
function renderOverlayInPage(s: any): void {
  try {
    const root = document.documentElement;
    if (s) { try { sessionStorage.setItem('ab_status', JSON.stringify(s)); } catch { /* noop */ } }
    if (!s || !root) { const ex = document.getElementById('ab-overlay'); if (!s && ex) ex.remove(); return; }

    const debug = !!s.debug;
    const mode = debug ? 'debug' : 'full';
    let o = document.getElementById('ab-overlay');
    if (o && o.getAttribute('data-mode') !== mode) { o.remove(); o = null; }

    if (!o) {
      o = document.createElement('div');
      o.id = 'ab-overlay';
      o.setAttribute('data-mode', mode);
      if (debug) {
        o.setAttribute('style', 'position:fixed;bottom:16px;right:16px;width:330px;max-height:60vh;z-index:2147483647;background:rgba(17,24,39,.93);color:#fff;border:1px solid rgba(168,195,0,.5);border-radius:10px;box-shadow:0 10px 34px rgba(0,0,0,.45);font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;overflow:hidden;');
        o.innerHTML = '<style>@keyframes ab-spin{to{transform:rotate(360deg)}}</style>'
          + '<div style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:7px;">'
          + '<span style="font-size:13px;font-weight:800;">Anzeigen<span style="color:#A8C300;">Boost</span></span>'
          + '<span style="font-size:9px;font-weight:800;color:#1f2937;background:#A8C300;padding:1px 6px;border-radius:6px;letter-spacing:.5px;">DEBUG</span>'
          + '<span id="ab-msg" style="font-size:11px;color:#cbd5e1;margin-left:auto;text-align:right;flex:1;min-width:0;"></span></div>'
          + '<div id="ab-log" style="padding:8px 12px;overflow-y:auto;font-size:11px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></div>';
      } else {
        o.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1f2937,#111827);font-family:system-ui,-apple-system,Segoe UI,sans-serif;');
        o.innerHTML = '<style>@keyframes ab-spin{to{transform:rotate(360deg)}}</style>'
          + '<div style="text-align:center;color:#fff;max-width:440px;padding:32px;">'
          + '<div style="font-size:22px;font-weight:800;letter-spacing:.5px;margin-bottom:26px;">Anzeigen<span style="color:#A8C300;">Boost</span></div>'
          + '<div id="ab-icon" style="display:flex;justify-content:center;margin-bottom:22px;"></div>'
          + '<div id="ab-msg" style="font-size:16px;font-weight:600;line-height:1.45;"></div>'
          + '<div id="ab-sub" style="font-size:13px;color:#9ca3af;margin-top:10px;"></div>'
          + '<div id="ab-actions" style="margin-top:22px;"></div>'
          + '</div>';
      }
      root.appendChild(o);
    }

    const msgEl = o.querySelector('#ab-msg') as HTMLElement | null;
    if (msgEl) msgEl.textContent = s.message || '';

    if (debug) {
      const logEl = o.querySelector('#ab-log') as HTMLElement | null;
      if (logEl) {
        const lines: string[] = s.log || [];
        logEl.innerHTML = lines.map((l) => {
          const c = l.charAt(0) === '✗' ? '#fca5a5' : l.charAt(0) === '✓' ? '#bef264' : '#e5e7eb';
          return '<div style="color:' + c + ';">' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
        }).join('');
        logEl.scrollTop = logEl.scrollHeight;
      }
      return;
    }

    const icon = o.querySelector('#ab-icon') as HTMLElement;
    const sub = o.querySelector('#ab-sub') as HTMLElement;
    const actions = o.querySelector('#ab-actions') as HTMLElement;
    if (s.phase === 'done') {
      icon.innerHTML = '<div style="width:52px;height:52px;border-radius:50%;background:#A8C300;color:#1f2937;font-size:30px;line-height:52px;font-weight:800;">✓</div>';
      sub.textContent = ''; actions.innerHTML = '';
    } else if (s.phase === 'error') {
      icon.innerHTML = '<div style="width:52px;height:52px;border-radius:50%;background:#ef4444;color:#fff;font-size:30px;line-height:52px;font-weight:800;">!</div>';
      sub.textContent = '';
      actions.innerHTML = '<button id="ab-close" style="background:#A8C300;color:#1f2937;border:0;border-radius:8px;padding:10px 22px;font-weight:700;cursor:pointer;font-size:14px;">Schließen</button>';
      const b = actions.querySelector('#ab-close') as HTMLElement | null;
      if (b) b.onclick = () => { try { sessionStorage.removeItem('ab_status'); } catch { /* noop */ } o!.remove(); };
    } else {
      icon.innerHTML = '<div style="width:52px;height:52px;border:4px solid rgba(168,195,0,.25);border-top-color:#A8C300;border-radius:50%;animation:ab-spin .8s linear infinite;"></div>';
      sub.textContent = 'Bitte diesen Tab nicht schließen.'; actions.innerHTML = '';
    }
  } catch { /* never let the overlay break the page */ }
}

/** Merge a patch into the tab's status, persist it, and repaint the page. */
async function applyStatus(tabId: number, patch: Partial<RepostStatus>): Promise<void> {
  const cur = statusByTab.get(tabId) || { message: '', phase: 'working' as StatusPhase, debug: false, log: [] };
  const next: RepostStatus = { ...cur, ...patch };
  statusByTab.set(tabId, next);
  try {
    await runMain(tabId, renderOverlayInPage, [next]);
  } catch (e: any) {
    log('⚠ status error:', e.message);
  }
}

async function setStatus(tabId: number, message: string, phase: StatusPhase = 'working'): Promise<void> {
  await applyStatus(tabId, { message, phase });
}

/** Switch the overlay into the small non-blocking debug widget. */
async function setDebugOverlay(tabId: number): Promise<void> {
  await applyStatus(tabId, { debug: true });
}

/** Append one line to the live debug log (e.g. "✓ Titel gesetzt"). */
async function debugLine(tabId: number, line: string): Promise<void> {
  const cur = statusByTab.get(tabId);
  const log = [...(cur?.log || []), line].slice(-40);
  await applyStatus(tabId, { log });
}

async function clearStatus(tabId: number): Promise<void> {
  statusByTab.delete(tabId);
  try {
    await runMain(tabId, () => {
      try { sessionStorage.removeItem('ab_status'); } catch { /* noop */ }
      const o = document.getElementById('ab-overlay');
      if (o) o.remove();
    }, []);
  } catch { /* tab may be gone */ }
}

// ─── Photo download (background context) ──────────────────────────────────────

async function downloadPhoto(url: string): Promise<Blob | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) { log(`⚠ download failed for ${url}: ${resp.status}`); return null; }
    return await resp.blob();
  } catch (e: any) {
    log(`⚠ download error for ${url}:`, e.message);
    return null;
  }
}

// ─── Scrape original ad ───────────────────────────────────────────────────────

async function fetchOriginalAdData(tabId: number, adId: string): Promise<Partial<AdData>> {
  try {
    await navigate(tabId, `https://www.kleinanzeigen.de/s-anzeige/${adId}`);

    const description = await runMain<string | null>(tabId, () => {
      const el = document.querySelector('p#viewad-description-text');
      return el ? (el.textContent || '').trim().substring(0, 2000) : null;
    }, []);

    // Read the price type from the AD'S OWN price element only — scanning the
    // whole document text wrongly matched "Zu verschenken" elsewhere on the page
    // and mislabelled priced ads as give-aways.
    const priceType = await runMain<string | null>(tabId, () => {
      const el = document.querySelector('#viewad-price') as HTMLElement | null;
      const t = (el?.textContent || '').trim();
      if (/verschenken/i.test(t)) return 'GIVE_AWAY';
      if (/\bVB\b/.test(t)) return 'NEGOTIABLE';
      if (/\d/.test(t)) return 'FIXED';
      return null;
    }, []);

    // Capture the category PATH (parent/leaf numeric ids) from the breadcrumb so
    // the create form lands on the exact same subcategory — not just "first leaf".
    // Breadcrumb links look like /s-haus-garten/c80 → take the deepest two ids.
    const categoryPath = await runMain<string | null>(tabId, () => {
      const crumb = document.querySelector('#vap-brdcrmb');
      if (!crumb) return null;
      const ids: string[] = [];
      crumb.querySelectorAll('a').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/\/c(\d+)/);
        if (m) ids.push(m[1]);
      });
      if (ids.length >= 2) return ids[ids.length - 2] + '/' + ids[ids.length - 1];
      if (ids.length === 1) return ids[0];
      return null;
    }, []);
    if (categoryPath) log('captured category path:', categoryPath);

    // Capture category-specific attributes (Art/Farbe/Material/Zustand/…) from the
    // ad's details list. Each row's value lives in .addetailslist--detail--value;
    // the label is the row text with that value removed. Resilient: {} if absent.
    const attributes = await runMain<Record<string, string>>(tabId, () => {
      const out: Record<string, string> = {};
      const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
      const items = document.querySelectorAll('#viewad-details .addetailslist--detail');
      items.forEach((item) => {
        const valEl = item.querySelector('.addetailslist--detail--value');
        if (!valEl) return;
        const value = norm(valEl.textContent || '');
        const full = norm(item.textContent || '');
        const label = (value && full.endsWith(value) ? full.slice(0, full.length - value.length) : full).trim();
        if (label && value) out[label] = value;
      });
      return out;
    }, []) || {};
    log('captured attributes:', attributes);

    await delay(2000); // let lazy images attach data-imgsrc
    const photoUrls = await runMain<string[]>(tabId, () => {
      const imgs = Array.from(document.querySelectorAll('img[data-imgsrc]'));
      const urls: string[] = [];
      imgs.forEach((img) => {
        const src = img.getAttribute('data-imgsrc');
        if (src && src.includes('img.kleinanzeigen.de')) urls.push(src);
      });
      return Array.from(new Set(urls)).slice(0, 10);
    }, []) || [];

    return { description: description || undefined, pictures: photoUrls.slice(0, 3), priceType: priceType as any, attributes, categoryPath: categoryPath || undefined };
  } catch (e: any) {
    log('⚠ failed to fetch original ad data:', e.message);
    return {};
  }
}

// ─── Form interactions ────────────────────────────────────────────────────────

async function fillField(tabId: number, selector: string, value: string, dbg = false, label?: string): Promise<boolean> {
  try {
    const ok = await runMain<boolean>(tabId, async (sel: string, val: string, dbgOn: boolean, hlMs: number) => {
      const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) return false;
      const fire = () => {
        // Use the NATIVE value setter so React's controlled-input state actually
        // updates (assigning el.value directly is ignored by React's tracker).
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        try { el.focus(); } catch { /* noop */ }
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      };
      if (dbgOn) {
        try { el.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
        const prev = el.style.outline;
        el.style.outline = '3px solid #ef4444';
        el.style.outlineOffset = '2px';
        await new Promise((r) => setTimeout(r, hlMs));
        fire();
        await new Promise((r) => setTimeout(r, 150));
        el.style.outline = prev;
        return true;
      }
      fire();
      return true;
    }, [selector, value, dbg, DEBUG_HIGHLIGHT_MS]);
    if (dbg) await debugLine(tabId, ok ? `✓ ${label || selector} gesetzt` : `✗ ${label || selector} nicht gefunden`);
    if (!ok) log(`✗ ${selector} not found`);
    return !!ok;
  } catch (e: any) {
    log(`✗ fill error for ${selector}:`, e.message);
    if (dbg) await debugLine(tabId, `✗ ${label || selector} Fehler`);
    return false;
  }
}

async function setPriceType(tabId: number, priceType: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY', dbg = false): Promise<boolean> {
  const labelMap = { FIXED: 'Festpreis', NEGOTIABLE: 'VB', GIVE_AWAY: 'Zu verschenken' };
  const optionText = labelMap[priceType];
  try {
    const opened = await runMain<boolean>(tabId, async (dbgOn: boolean, hlMs: number) => {
      const btn = document.querySelector('button#ad-price-type') as HTMLElement | null;
      if (!btn) return false;
      if (dbgOn) { try { btn.scrollIntoView({ block: 'center' }); } catch { /* noop */ } btn.style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      btn.click();
      if (dbgOn) btn.style.outline = '';
      return true;
    }, [dbg, DEBUG_HIGHLIGHT_MS]);
    if (!opened) { log('✗ price type button not found'); if (dbg) await debugLine(tabId, '✗ Preistyp-Button nicht gefunden'); return false; }
    await wait(500);

    const selected = await runMain<boolean>(tabId, async (text: string, dbgOn: boolean, hlMs: number) => {
      const items = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li'));
      const opt = items.find((el) => (el.textContent || '').trim() === text) as HTMLElement | undefined;
      if (!opt) return false;
      if (dbgOn) { try { opt.scrollIntoView({ block: 'center' }); } catch { /* noop */ } opt.style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      opt.click();
      if (dbgOn) opt.style.outline = '';
      return true;
    }, [optionText, dbg, DEBUG_HIGHLIGHT_MS]);
    if (!selected) { log(`✗ option "${optionText}" not found`); if (dbg) await debugLine(tabId, `✗ Preistyp „${optionText}" nicht gefunden`); return false; }
    await wait(500);

    await runMain(tabId, () => {
      const input = document.querySelector('input[name="priceType"]') as HTMLInputElement | null;
      if (input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, []);
    if (dbg) await debugLine(tabId, `✓ Preistyp: ${optionText}`);
    return true;
  } catch (e: any) {
    log('✗ price type error:', e.message);
    if (dbg) await debugLine(tabId, '✗ Preistyp Fehler');
    return false;
  }
}

async function setShipping(tabId: number, shippingType: 'ja' | 'nein', dbg = false): Promise<boolean> {
  const targetId = shippingType === 'ja' ? 'ad-shipping-enabled-yes' : 'ad-shipping-enabled-no';
  const wantText = shippingType === 'ja' ? 'Versand möglich' : 'Nur Abholung';
  try {
    const result = await runMain<string>(tabId, async (id: string, text: string, dbgOn: boolean, hlMs: number) => {
      // 1) Try the known radio id. 2) Fall back to a radio whose label text
      //    matches "Versand möglich" / "Nur Abholung" (the shipping block is
      //    category-dependent, and ids have changed across redesigns).
      let input = document.querySelector('#' + id) as HTMLInputElement | null;
      let clickTarget: HTMLElement | null = input;
      if (!input) {
        const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];
        const lbl = labels.find((l) => (l.textContent || '').trim().toLowerCase().includes(text.toLowerCase()));
        if (lbl) {
          const forId = lbl.getAttribute('for');
          input = (forId ? document.getElementById(forId) : lbl.querySelector('input[type="radio"]')) as HTMLInputElement | null;
          clickTarget = lbl;
        }
      }
      if (!input) return 'no_field';
      const lbl = (clickTarget || input.closest('label') || input.parentElement || input) as HTMLElement;
      if (dbgOn) { try { lbl.scrollIntoView({ block: 'center' }); } catch { /* noop */ } lbl.style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      lbl.click();
      if (!input.checked) input.click(); // ensure the radio actually toggled
      if (dbgOn) { await new Promise((r) => setTimeout(r, 150)); lbl.style.outline = ''; }
      return input.checked ? 'ok' : 'not_checked';
    }, [targetId, wantText, dbg, DEBUG_HIGHLIGHT_MS]);

    const ok = result === 'ok';
    if (dbg) await debugLine(tabId, ok ? `✓ Versand: ${shippingType === 'ja' ? 'möglich' : 'nur Abholung'}` : `✗ Versand nicht gesetzt (${result})`);
    if (!ok) log('✗ shipping selection failed:', result);
    return ok;
  } catch (e: any) {
    log('✗ shipping error:', e.message);
    if (dbg) await debugLine(tabId, '✗ Versand Fehler');
    return false;
  }
}

/**
 * Select the category by its numeric PATH ("parent/leaf", e.g. "80/88"): open
 * the picker → click parent cat_<parent> → click the EXACT leaf cat_<leaf>
 * (not "first leaf") → Weiter. Falls back to first leaf if only a parent id is
 * known. Verifies a category actually got selected.
 */
async function setCategory(tabId: number, path?: string, dbg = false): Promise<boolean> {
  if (!path) return true;
  const [parentId, leafId] = path.split('/');
  try {
    // Open the category picker. Prefer the explicit "Kategorie ändern/wählen"
    // control; log candidates in debug so we can see what was clicked.
    const opened = await runMain<boolean>(tabId, async (dbgOn: boolean, hlMs: number) => {
      const els = Array.from(document.querySelectorAll('a, button, div[role="button"]')) as HTMLElement[];
      const score = (t: string) => /kategorie (ändern|wählen|auswählen)|wähle deine kategorie/i.test(t) ? 2 : /kategorie/i.test(t) ? 1 : 0;
      const trigger = els
        .map((el) => ({ el, s: score((el.textContent || '').trim()) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)[0]?.el;
      if (!trigger) return false;
      if (dbgOn) { try { trigger.scrollIntoView({ block: 'center' }); } catch { /* noop */ } trigger.style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      trigger.click();
      return true;
    }, [dbg, DEBUG_HIGHLIGHT_MS]);
    if (!opened) { log('✗ Kategorie trigger not found'); if (dbg) await debugLine(tabId, '✗ Kategorie-Auswahl nicht gefunden'); return false; }
    await wait(1500);

    // Click the parent category by id.
    const parentClicked = await runMain<boolean>(tabId, async (id: string, dbgOn: boolean, hlMs: number) => {
      const link = document.querySelector('a#cat_' + id) as HTMLElement | null;
      if (!link) { (window as any).__abCats = Array.from(document.querySelectorAll('a[id^="cat_"]')).map((a) => a.id).join(','); return false; }
      if (dbgOn) { try { link.scrollIntoView({ block: 'center' }); } catch { /* noop */ } link.style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      link.click();
      if (dbgOn) link.style.outline = '';
      return true;
    }, [parentId, dbg, DEBUG_HIGHLIGHT_MS]);
    if (!parentClicked) {
      const avail = await runMain<string>(tabId, () => (window as any).__abCats || '', []);
      log(`✗ parent cat_${parentId} not found. available:`, avail);
      if (dbg) await debugLine(tabId, `✗ Oberkategorie cat_${parentId} nicht gefunden`);
      return false;
    }
    await wait(1000);

    // Click the EXACT leaf by id (cat_<leaf>); fall back to the first leaf.
    const leafClicked = await runMain<string | false>(tabId, async (lid: string, dbgOn: boolean, hlMs: number) => {
      const leaf = (lid ? document.querySelector('a#cat_' + lid) : null)
        || document.querySelector('li.category-selection-list-item.is-leaf a') as HTMLElement | null;
      if (!leaf) return false;
      const txt = ((leaf as HTMLElement).textContent || '').trim();
      if (dbgOn) { try { (leaf as HTMLElement).scrollIntoView({ block: 'center' }); } catch { /* noop */ } (leaf as HTMLElement).style.outline = '3px solid #ef4444'; await new Promise((r) => setTimeout(r, hlMs)); }
      (leaf as HTMLElement).click();
      if (dbgOn) (leaf as HTMLElement).style.outline = '';
      return txt || 'ok';
    }, [leafId || '', dbg, DEBUG_HIGHLIGHT_MS]);
    if (!leafClicked) { log('✗ no leaf category found'); if (dbg) await debugLine(tabId, '✗ Unterkategorie nicht gefunden'); return false; }
    await wait(1000);

    // Confirm with "Weiter" (navigates back to the form).
    const nextClicked = await runMain<boolean>(tabId, () => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((el) => (el.textContent || '').trim() === 'Weiter') as HTMLElement | undefined;
      if (!btn) return false;
      btn.click();
      return true;
    }, []);
    if (!nextClicked) { log('✗ Weiter button not found'); if (dbg) await debugLine(tabId, '✗ „Weiter" nicht gefunden'); return false; }

    if (!(await waitForElement(tabId, 'input#ad-title', 15000))) { log('✗ form not found after category'); return false; }

    // Verify a category is actually selected (form no longer shows the prompt).
    const verify = await runMain<{ label: string; prompt: boolean }>(tabId, () => {
      const pathEl = document.querySelector('#ad-category-path');
      const label = pathEl ? (pathEl.textContent || '').trim() : '';
      const prompt = /Wähle deine Kategorie/i.test(document.body.textContent || '');
      return { label, prompt };
    }, []) || { label: '', prompt: true };
    const okSel = !!verify.label || !verify.prompt;
    log(`category result: leaf="${leafClicked}" pathLabel="${verify.label}" stillPrompting=${verify.prompt}`);
    if (dbg) await debugLine(tabId, okSel ? `✓ Kategorie: ${verify.label || leafClicked}` : '✗ Kategorie scheint NICHT gesetzt (Prompt sichtbar)');
    return okSel;
  } catch (e: any) {
    log('✗ category error:', e.message);
    if (dbg) await debugLine(tabId, '✗ Kategorie Fehler');
    return false;
  }
}

async function uploadPhotos(tabId: number, photoBlobs: Blob[], dbg = false): Promise<boolean> {
  if (photoBlobs.length === 0) return true;
  try {
    const base64Files = await Promise.all(photoBlobs.map(async (blob, i) => {
      const arr = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let j = 0; j < arr.length; j++) binary += String.fromCharCode(arr[j]);
      return { b64: btoa(binary), name: `photo-${i}.jpg` };
    }));

    const result = await runMain<string>(tabId, async (files: { b64: string; name: string }[], dbgOn: boolean, hlMs: number) => {
      let input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement | null;
      if (!input) input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!input) return 'no_input';

      if (dbgOn) {
        const zone = (input.closest('div') || input.parentElement || input) as HTMLElement;
        try { zone.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
        zone.style.outline = '3px solid #ef4444';
        await new Promise((r) => setTimeout(r, hlMs));
        zone.style.outline = '';
      }

      const dt = new DataTransfer();
      for (const f of files) {
        try {
          const binary = atob(f.b64);
          const a = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) a[i] = binary.charCodeAt(i);
          dt.items.add(new File([new Blob([a], { type: 'image/jpeg' })], f.name, { type: 'image/jpeg' }));
        } catch { /* skip bad file */ }
      }
      if (dt.files.length === 0) return 'empty';
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok:' + dt.files.length;
    }, [base64Files, dbg, DEBUG_HIGHLIGHT_MS]);

    const ok = !!result && result.includes('ok');
    if (dbg) await debugLine(tabId, ok ? `✓ ${photoBlobs.length} Foto(s) hochgeladen` : `✗ Foto-Upload fehlgeschlagen (${result})`);
    return ok;
  } catch (e: any) {
    log('✗ photo upload error:', e.message);
    if (dbg) await debugLine(tabId, '✗ Foto-Upload Fehler');
    return false;
  }
}

async function submitForm(tabId: number): Promise<boolean> {
  try {
    const click = await runMain<{ clicked: boolean; text?: string; disabled?: boolean }>(tabId, () => {
      const btns = Array.from(document.querySelectorAll('button'));
      let btn = btns.find((b) => (b.textContent || '').toLowerCase().includes('aufgeben')) as HTMLButtonElement | undefined;
      if (!btn) btn = (document.querySelector('button[type="submit"]') as HTMLButtonElement) || undefined;
      if (!btn) return { clicked: false };
      try { btn.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
      const disabled = btn.disabled;
      btn.click();
      return { clicked: true, text: (btn.textContent || '').trim(), disabled };
    }, []);
    if (!click?.clicked) { log('✗ submit button not found'); return false; }
    log(`submit: clicked "${click.text}" (disabled=${click.disabled})`);

    // Real success = redirect to the confirmation page
    // (p-anzeige-aufgeben-bestaetigung.html?adId=…, verified vs the live site).
    // Failure = an error page, or staying on the form (validation rejected it).
    for (let i = 0; i < 24; i++) {
      await delay(500);
      let url = '';
      try { url = (await runMain<string>(tabId, () => window.location.href, [])) || ''; } catch { /* mid-nav */ }
      if (url.includes('bestaetigung')) { log('✓ submit confirmed — confirmation page:', url); return true; }
      if (url.includes('fehler') || url.includes('-error') || url.includes('error.html')) { log('✗ submit → error page:', url); return false; }
    }

    // Still on the form → capture WHY (which validation error / empty field) so a
    // rejected submit is never mistaken for success.
    const diag = await runMain<any>(tabId, () => {
      const errs: string[] = [];
      document.querySelectorAll('[class*="error" i], [role="alert"], .Indicator--negative, [data-testid*="error"], .formgroup--error, .error-message')
        .forEach((e) => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length > 1 && t.length < 200) errs.push(t); });
      const val = (s: string) => (document.querySelector(s) as HTMLInputElement | null)?.value ?? '(missing)';
      return {
        url: window.location.href,
        errors: Array.from(new Set(errs)).slice(0, 25),
        fields: {
          title: val('input#ad-title'),
          price: val('input#ad-price-amount'),
          category: val('input[name="categoryId"]'),
          priceType: val('input[name="priceType"]'),
          stillPrompting: /Wähle deine Kategorie/i.test(document.body.textContent || ''),
        },
      };
    }, []);
    log('✗ submit NOT confirmed — stayed on form. diag:', JSON.stringify(diag));
    return false;
  } catch (e: any) {
    log('✗ submit error:', e.message);
    return false;
  }
}

/**
 * Delete the OLD ad AFTER a confirmed publish (best-effort, non-fatal). Goes to
 * "Meine Anzeigen", finds the original ad by id, clicks its delete control
 * (handling a possible ⋯-menu), and confirms. If anything isn't found it logs and
 * returns false — the repost still counts as a success; only a duplicate remains.
 */
async function deleteOldAd(tabId: number, adId: string, dbg = false): Promise<boolean> {
  try {
    await navigate(tabId, 'https://www.kleinanzeigen.de/m-meine-anzeigen.html');
    await wait(2000);

    const result = await runMain<string>(tabId, async (id: string, dbgOn: boolean, hlMs: number) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const txt = (el: Element | null) => ((el?.textContent || '') + (el?.getAttribute?.('aria-label') || '') + (el?.getAttribute?.('title') || '')).toLowerCase();

      // Locate the ad card (by data-* id, or a card containing a link to the ad).
      let card: HTMLElement | null = document.querySelector(`[data-adid="${id}"], [data-id="${id}"], [data-ad-id="${id}"]`) as HTMLElement | null;
      if (!card) {
        const link = document.querySelector(`a[href*="/s-anzeige/${id}"], a[href*="${id}"]`);
        card = (link?.closest('article, li, .cardbox, [class*="card" i]') as HTMLElement) || null;
      }
      if (!card) return 'card_not_found';

      // Find a delete control in the card; if hidden behind a ⋯-menu, open it first.
      const findDelete = (root: ParentNode) => Array.from(root.querySelectorAll('button, a, [role="menuitem"]'))
        .find((b) => /löschen|delete/.test(txt(b))) as HTMLElement | undefined;
      let delBtn = findDelete(card);
      if (!delBtn) {
        const menu = Array.from(card.querySelectorAll('button, a'))
          .find((b) => /menü|menu|mehr|more|optionen|weitere/.test(txt(b)) || (b.textContent || '').trim() === '⋯') as HTMLElement | undefined;
        if (menu) { menu.click(); await sleep(600); delBtn = findDelete(document); }
      }
      if (!delBtn) return 'delete_btn_not_found';

      if (dbgOn) { try { delBtn.scrollIntoView({ block: 'center' }); } catch { /* noop */ } delBtn.style.outline = '3px solid #ef4444'; await sleep(hlMs); }
      delBtn.click();
      await sleep(1200);

      // Confirm in the dialog (prefer a dialog-scoped "… löschen" button).
      const dlg = document.querySelector('[role="dialog"], dialog[open]') || document;
      const confirm = Array.from(dlg.querySelectorAll('button'))
        .find((b) => /löschen|bestätigen/.test((b.textContent || '').toLowerCase().trim())) as HTMLElement | undefined;
      if (!confirm) return 'no_confirm';
      confirm.click();
      await sleep(1500);
      return 'deleted';
    }, [adId, dbg, DEBUG_HIGHLIGHT_MS]);

    const ok = result === 'deleted';
    log(`delete old ad ${adId}: ${result}`);
    if (dbg) await debugLine(tabId, ok ? '✓ Alte Anzeige gelöscht' : `⚠ Alte Anzeige nicht entfernt (${result})`);
    return ok;
  } catch (e: any) {
    log('✗ delete old ad error:', e.message);
    return false;
  }
}

// ─── Dynamic category attributes (WRITE side) ─────────────────────────────────
// Replays the captured original-ad attributes (Art/Farbe/Material/Zustand/…)
// into the category-specific fields, which only exist AFTER the category is set.
//
// Category-agnostic: fields are matched by their visible <label> text (NOT by a
// hardcoded category prefix like "wohnzimmer.color"). Three control types are
// handled — combobox (button[role=combobox] → listbox options), the Zustand
// MODAL (button[aria-haspopup=dialog] → [role=dialog] → radio → "Bestätigen"),
// and plain inputs. Everything is best-effort: a missing field is skipped, a
// present-but-unsettable field is logged as failed; it never throws.

interface AttrSummary { filled: string[]; skipped: string[]; failed: string[] }

/** Self-contained MAIN-world routine that sets ONE attribute. Returns a status
 *  code: "filled" | "skip:<reason>" | "fail:<reason>" (prefixed for the caller). */
function fillOneAttributeInPage(label: string, value: string, dbgOn: boolean, hlMs: number): Promise<string> {
  return (async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const norm = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(label);
    const wantVal = norm(value);
    if (!want) return 'skip:empty';

    const hl = async (el: any) => {
      if (!dbgOn || !el) return;
      try { el.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
      el.style.outline = '3px solid #ef4444'; el.style.outlineOffset = '2px';
      await sleep(hlMs);
    };
    const unhl = (el: any) => { if (dbgOn && el) try { el.style.outline = ''; } catch { /* noop */ } };

    // German display label → Kleinanzeigen attribute key suffix (category-agnostic;
    // the field id/name is "<category>.<key>", e.g. "wohnzimmer.color").
    const KEY_MAP: Record<string, string> = {
      'farbe': 'color', 'material': 'material', 'zustand': 'condition', 'art': 'art',
      'größe': 'size', 'groesse': 'size', 'grösse': 'size', 'marke': 'brand', 'typ': 'type',
    };

    // 1) Match the field by its visible label text (exact, then prefix).
    const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];
    const lblEl = labels.find((l) => norm(l.textContent) === want)
      || labels.find((l) => norm(l.textContent).replace(/\*$/, '').trim() === want)
      || labels.find((l) => norm(l.textContent).startsWith(want));

    let required = lblEl && /\*/.test(lblEl.textContent || '') ? ':required' : '';
    let ctrl: any = null;
    let forId: string | null = lblEl ? lblEl.getAttribute('for') : null;

    // 2a) Resolve the control the label points to (for=id, else first control in scope).
    if (lblEl) {
      if (forId) ctrl = document.getElementById(forId);
      if (!ctrl) {
        const scope = (lblEl.closest('div,fieldset,section') || document) as ParentNode;
        ctrl = scope.querySelector('button[role="combobox"], button[aria-haspopup], select, input:not([type="hidden"]), textarea');
      }
    }

    // 2b) Fallback: match by id/name suffix using the label→key map. Robust when
    //     the visible label isn't a <label> element or its text differs.
    if (!ctrl) {
      const key = KEY_MAP[want];
      if (key) {
        const cands = Array.from(document.querySelectorAll(
          '[id$=".' + key + '"], [name$=".' + key + ']"], [name*="[' + key + ']"]',
        )) as HTMLElement[];
        const interactive = cands.find((c) => {
          const t = c.tagName.toLowerCase();
          const ty = (c.getAttribute('type') || '').toLowerCase();
          return t === 'button' || t === 'select' || t === 'textarea' || (t === 'input' && ty !== 'hidden');
        });
        if (interactive) {
          ctrl = interactive; forId = interactive.id || forId;
        } else if (cands.length) {
          // Only a hidden input matched → find its visible trigger nearby.
          const hidden = cands[0];
          forId = hidden.id || forId;
          const scope = (hidden.closest('div,fieldset,section') || document) as ParentNode;
          ctrl = scope.querySelector('button[role="combobox"], button[aria-haspopup], select');
          if (!required && /required|aria-required/i.test(hidden.outerHTML)) required = ':required';
        }
      }
    }

    if (!ctrl) return 'skip:no_field';

    const tag = (ctrl.tagName || '').toLowerCase();
    const role = (ctrl.getAttribute && (ctrl.getAttribute('role') || '')).toLowerCase();
    const haspopup = (ctrl.getAttribute && (ctrl.getAttribute('aria-haspopup') || '')).toLowerCase();
    const isCondition = haspopup === 'dialog' || (forId && /\.condition/i.test(forId)) || want === 'zustand';

    // 3a) MODAL (Zustand / condition). The dialog trigger is a dedicated
    //     button[aria-haspopup=dialog] near the label — NOT the label's `for`
    //     target (which is often the hidden value input). Resolve it explicitly.
    if (isCondition) {
      let trigger: any = (ctrl && (ctrl.tagName || '').toLowerCase() === 'button' && haspopup === 'dialog') ? ctrl : null;
      if (!trigger) {
        const condLabels = Array.from(document.querySelectorAll('label')).filter((l) =>
          norm(l.textContent).startsWith('zustand') || /\.condition/i.test(l.getAttribute('for') || ''));
        for (const l of condLabels) {
          const scope = (l.closest('div,fieldset,section') || document) as ParentNode;
          const b = scope.querySelector('button[aria-haspopup="dialog"], button[aria-haspopup="true"]');
          if (b) { trigger = b; break; }
        }
      }
      if (!trigger) trigger = document.querySelector('button[aria-haspopup="dialog"]');
      if (!trigger) return 'fail:no_trigger' + required;
      await hl(trigger); trigger.click(); unhl(trigger);
      let dlg: Element | null = null;
      for (let i = 0; i < 25; i++) { await sleep(150); dlg = document.querySelector('[role="dialog"], dialog[open]'); if (dlg) break; }
      if (!dlg) return 'fail:no_dialog' + required;
      const opts = Array.from(dlg.querySelectorAll('label, [role="radio"], [role="option"], button, li')) as HTMLElement[];
      const opt = opts.find((o) => norm(o.textContent) === wantVal) || opts.find((o) => norm(o.textContent).includes(wantVal));
      if (!opt) return 'fail:no_option' + required;
      await hl(opt); opt.click(); unhl(opt);
      await sleep(200);
      const confirm = (Array.from(dlg.querySelectorAll('button')) as HTMLElement[])
        .find((b) => norm(b.textContent).includes('bestätigen') || norm(b.textContent).includes('bestatigen'));
      if (confirm) confirm.click();
      for (let i = 0; i < 25; i++) { await sleep(150); if (!document.querySelector('[role="dialog"], dialog[open]')) break; }
      return 'filled';
    }

    // 3b) COMBOBOX (button → listbox)
    if (tag === 'button' && (role === 'combobox' || haspopup === 'listbox' || haspopup === 'true' || haspopup === 'menu')) {
      await hl(ctrl); ctrl.click();
      let opts: HTMLElement[] = [];
      for (let i = 0; i < 25; i++) {
        await sleep(120);
        opts = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] li')) as HTMLElement[];
        if (opts.length) break;
      }
      unhl(ctrl);
      if (!opts.length) opts = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li')) as HTMLElement[];
      const opt = opts.find((o) => norm(o.textContent) === wantVal) || opts.find((o) => norm(o.textContent).includes(wantVal));
      if (!opt) { try { ctrl.click(); } catch { /* close */ } return 'fail:no_option' + required; }
      await hl(opt); opt.click(); unhl(opt);
      await sleep(150);
      return 'filled';
    }

    // 3c) Native <select>
    if (tag === 'select') {
      await hl(ctrl);
      const options = Array.from((ctrl as HTMLSelectElement).options);
      const opt = options.find((o) => norm(o.textContent) === wantVal) || options.find((o) => norm(o.textContent).includes(wantVal));
      if (!opt) { unhl(ctrl); return 'fail:no_option' + required; }
      (ctrl as HTMLSelectElement).value = opt.value;
      ctrl.dispatchEvent(new Event('input', { bubbles: true }));
      ctrl.dispatchEvent(new Event('change', { bubbles: true }));
      unhl(ctrl);
      return 'filled';
    }

    // 3d) Plain text / number input or textarea
    if (tag === 'input' || tag === 'textarea') {
      await hl(ctrl);
      (ctrl as HTMLInputElement).value = value;
      ctrl.dispatchEvent(new Event('input', { bubbles: true }));
      ctrl.dispatchEvent(new Event('change', { bubbles: true }));
      ctrl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      unhl(ctrl);
      return 'filled';
    }

    return 'skip:unsupported';
  })();
}

/** Replay all captured attributes into the form. Best-effort, never throws. */
async function fillDynamicAttributes(tabId: number, attributes: Record<string, string> | undefined, dbg = false): Promise<AttrSummary> {
  const summary: AttrSummary = { filled: [], skipped: [], failed: [] };
  const entries = Object.entries(attributes || {});
  if (entries.length === 0) return summary;

  for (const [label, value] of entries) {
    let res = '';
    try {
      res = (await runMain<string>(tabId, fillOneAttributeInPage, [label, value, dbg, DEBUG_HIGHLIGHT_MS])) || 'fail:error';
    } catch (e: any) {
      res = 'fail:error';
    }

    if (res === 'filled') {
      summary.filled.push(label);
      if (dbg) await debugLine(tabId, `✓ ${label}: ${value}`);
    } else if (res.startsWith('skip')) {
      summary.skipped.push(label);
      if (dbg) await debugLine(tabId, `skip ${label} (kein Feld)`);
    } else {
      summary.failed.push(label);
      const reason = res.replace(/^fail:/, '');
      log(`✗ attribute "${label}" (${value}) failed: ${reason}`);
      if (dbg) await debugLine(tabId, `✗ ${label}: ${value} (${reason})`);
    }
    await wait(300);
  }

  log('attributes summary:', summary);
  return summary;
}

// ─── Overlay content-script registration (document_start, every navigation) ───

const OVERLAY_SCRIPT_ID = 'ab-overlay-paint';

/** Register the document_start painter so every page in the flow shows the
 *  overlay with zero flash. Idempotent. */
export async function registerOverlayScript(): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] }).catch(() => {});
    await chrome.scripting.registerContentScripts([{
      id: OVERLAY_SCRIPT_ID,
      js: ['overlay.js'],
      matches: ['https://*.kleinanzeigen.de/*'],
      runAt: 'document_start',
      persistAcrossSessions: false,
    }]);
  } catch (e: any) {
    log('⚠ overlay register failed:', e.message);
  }
}

export async function unregisterOverlayScript(): Promise<void> {
  try { await chrome.scripting.unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] }); } catch { /* noop */ }
}

// ─── Main flow ────────────────────────────────────────────────────────────────

export async function executeRepostFullFlow(
  tabId: number,
  adId: string,
  adData?: AdData,
  deleteOldAdTiming: 'AFTER_PUBLISH' | 'NEVER' = 'AFTER_PUBLISH',
  debug = false,
): Promise<{ ok: boolean; step: string; finalUrl?: string; error?: string }> {
  let step = 'start';
  let success = false;

  // DEV-only: honour debug from the param OR the module switch. A shipped build
  // has REPOST_DEBUG=false and no caller passes debug=true, so dbg is always false.
  const dbg = debug || REPOST_DEBUG;
  DELAY_SCALE = dbg ? DEBUG_DELAY_SCALE : 1;
  if (dbg) log('▶ DEBUG MODE: slow + highlight, will NOT submit');

  try {
    // Show the overlay immediately. In debug mode it's the small non-blocking
    // widget so the form stays visible while it fills.
    if (dbg) await setDebugOverlay(tabId);
    await setStatus(tabId, dbg ? 'DEBUG-Lauf — Formular wird befüllt…' : 'AnzeigenBoost stellt deine Anzeige neu ein…');

    // Fetch original ad data
    step = 'fetch_original_ad';
    await setStatus(tabId, 'Anzeigendaten werden geladen…');
    const originalData = await fetchOriginalAdData(tabId, adId);
    // Always merge scraped data (description/priceType/attributes), but keep
    // backend-provided pictures when present, else fall back to scraped ones.
    const mergedPictures = adData?.pictures?.length
      ? adData.pictures
      : (originalData.pictures?.slice(0, adData?.imageCount || 3) || []);
    adData = { ...adData, ...originalData, pictures: mergedPictures } as AdData;

    // Download photos (with live counter)
    step = 'download_photos';
    let photoBlobs: Blob[] = [];
    if (adData?.pictures?.length) {
      const total = adData.pictures.length;
      await setStatus(tabId, `Fotos werden vorbereitet… (0/${total})`);
      const blobs: (Blob | null)[] = [];
      for (let i = 0; i < adData.pictures.length; i++) {
        blobs.push(await downloadPhoto(adData.pictures[i]));
        await setStatus(tabId, `Fotos werden vorbereitet… (${i + 1}/${total})`);
      }
      photoBlobs = blobs.filter((b): b is Blob => b !== null);
    }

    // Open the create form
    step = 'navigate_form';
    await setStatus(tabId, 'Formular wird geöffnet…');
    await navigate(tabId, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html');
    if (!(await waitForElement(tabId, 'input#ad-title', 15000))) {
      if (await isOnLoginPage(tabId)) throw new Error('LOGIN_REQUIRED');
      throw new Error('form not found after navigation');
    }
    if (dbg) await setDebugOverlay(tabId); // re-assert widget after navigation

    // 1) Category FIRST (determines which fields render → no later reset).
    //    Prefer the exact scraped path (parent/leaf); fall back to the L1 id.
    //    Non-fatal: if it fails we still fill the rest so debug shows everything.
    step = 'set_category';
    const categoryTarget = adData?.categoryPath || adData?.l1Category;
    log('category target:', categoryTarget, '| l1Category:', adData?.l1Category, '| categoryPath:', adData?.categoryPath);
    if (categoryTarget) {
      await setStatus(tabId, 'Kategorie wird gewählt…');
      const catOk = await setCategory(tabId, categoryTarget, dbg);
      if (!catOk) log('⚠ category selection failed — attributes may be skipped');
      await wait(1500);
      if (dbg) await setDebugOverlay(tabId); // category step navigates → re-assert
    } else {
      log('⚠ no category target (l1Category & categoryPath both empty)');
      if (dbg) await debugLine(tabId, '✗ Keine Kategorie-Daten (l1Category & categoryPath leer)');
    }

    // 2) Dynamic category attributes (Art/Farbe/Material/Zustand/…) — only exist
    //    now that the category has rendered the form. Best-effort, never throws.
    step = 'fill_attributes';
    if (adData?.attributes && Object.keys(adData.attributes).length > 0) {
      await setStatus(tabId, 'Merkmale werden übernommen…');
      await fillDynamicAttributes(tabId, adData.attributes, dbg);
      await wait(500);
    }

    // 3) Upload photos
    step = 'upload_photos';
    if (photoBlobs.length > 0) {
      await setStatus(tabId, 'Fotos werden hochgeladen…');
      if (!(await uploadPhotos(tabId, photoBlobs, dbg))) log('⚠ photo upload incomplete, continuing');
      await wait(1000);
    }

    // 3) Price type
    step = 'set_price_type';
    let selectedPriceType: 'FIXED' | 'NEGOTIABLE' | 'GIVE_AWAY' = 'FIXED';
    const priceNum = typeof adData?.price === 'string'
      ? (parseInt(adData.price.replace(/[^\d]/g, ''), 10) || 0)
      : (adData?.price ?? 0);
    // A real price (>0) always wins over a scraped priceType — only treat as
    // give-away when there is genuinely no price.
    if (priceNum > 0) selectedPriceType = adData?.priceType === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
    else if (adData?.priceType === 'GIVE_AWAY' || priceNum === 0) selectedPriceType = 'GIVE_AWAY';
    else selectedPriceType = 'FIXED';
    await setPriceType(tabId, selectedPriceType, dbg);
    await wait(500);

    // 4) Description + price (description sanitized of any JSON/quote artifacts)
    step = 'fill_fields';
    await setStatus(tabId, 'Formular wird ausgefüllt…');
    const cleanDescription = cleanText(adData?.description);
    if (cleanDescription) await fillField(tabId, 'textarea#ad-description', cleanDescription, dbg, 'Beschreibung');
    if (adData?.price) await fillField(tabId, 'input#ad-price-amount', String(adData.price), dbg, 'Preis');
    await wait(500);

    // 5) Shipping
    step = 'set_shipping';
    await setShipping(tabId, 'ja', dbg);
    await wait(500);

    // 6) Title — deferred to right before submit (prevents React re-render clearing it)
    step = 'set_title';
    const cleanTitle = cleanText(adData?.title).slice(0, KA_TITLE_MAX_CHARS);
    log('title value:', cleanTitle ? `"${cleanTitle}"` : '(empty)');
    if (cleanTitle) {
      const titleOk = await fillField(tabId, 'input#ad-title', cleanTitle, dbg, 'Titel');
      if (!titleOk) {
        // Fallback selectors in case the title field id changed.
        for (const sel of ['input[name="title"]', 'input[name="postad-title"]', '#postad-title']) {
          if (await fillField(tabId, sel, cleanTitle, dbg, 'Titel (fallback)')) break;
        }
      }
    } else if (dbg) {
      await debugLine(tabId, '✗ Titel leer (adData.title fehlt)');
    }
    await wait(500);

    // 7) Submit — SKIPPED in debug mode so we don't post a real ad on every test
    //    run; the filled form is left on screen for inspection.
    step = 'submit';
    if (dbg) {
      log('DEBUG: stopping before submit — form left filled for inspection.');
      await debugLine(tabId, '— DEBUG: Stoppe vor dem Absenden. Formular bleibt zur Prüfung ausgefüllt.');
      await setStatus(tabId, 'DEBUG: Formular befüllt — nicht abgesendet.');
      return { ok: true, step: 'debug_filled' };
    }

    await setStatus(tabId, 'Anzeige wird veröffentlicht…');
    if (!(await submitForm(tabId))) throw new Error('form submission not confirmed');

    const finalUrl = await runMain<string>(tabId, () => window.location.href, []);
    success = true;

    // 8) Delete the OLD ad AFTER a confirmed publish (best-effort, non-fatal) so
    //    the repost replaces the listing instead of leaving a duplicate.
    if (deleteOldAdTiming !== 'NEVER') {
      step = 'delete_old_ad';
      await setStatus(tabId, 'Alte Anzeige wird entfernt…');
      await deleteOldAd(tabId, adId, dbg);
    }

    return { ok: true, step: 'submitted', finalUrl };
  } catch (e: any) {
    log('✗ failed at step:', step, '|', e.message);
    if (dbg) await debugLine(tabId, `✗ Abbruch bei „${step}": ${e.message}`);
    return { ok: false, step, error: e.message };
  } finally {
    DELAY_SCALE = 1; // reset global scale for the next flow
    try {
      // In debug mode, leave the widget + filled form on screen for inspection.
      if (!dbg) {
        if (success) {
          await setStatus(tabId, '✅ Fertig! Deine Anzeige ist wieder ganz oben.', 'done');
          await delay(2500);
          await clearStatus(tabId);
        } else {
          await setStatus(tabId, 'Etwas ist schiefgelaufen — bitte erneut versuchen.', 'error');
        }
      }
    } catch (e: any) {
      log('final status error:', e.message);
    }
  }
}
