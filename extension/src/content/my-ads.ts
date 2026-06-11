/**
 * "Meine Anzeigen" in-page actions.
 *
 * Injects three buttons onto each ad card:
 *   🔄 Neu stellen  → server-side repost (POST /api/ads/repost/:id), confirm + cooldown
 *   ✨ KI-Inhalt     → 3 AI title/description variants, click to copy
 *   📊 Dashboard     → open the AnzeigenBoost dashboard for this ad
 *
 * The Firestore ad doc ID equals KA's native ad id (see ads.service import),
 * so the id scraped from the page maps directly to the backend.
 */
import { REPOST_COOLDOWN_HOURS } from '../config/features';

// Inlined (not imported from endpoints.ts) so the content bundle stays a
// classic script with no ES imports. Keep in sync with config/endpoints.ts.
const DASHBOARD_BASE = 'http://localhost:5173';

const MARKER = 'data-anzeigenboost-actions';
const REPOST_LOG_KEY = 'anzeigenboost-repost-log';

// Single green accent for all three buttons (Kleinanzeigen brand green —
// kept identical to the dashboard's ka-green token for cross-surface consistency).
const GREEN = '#A8C300';
const GREEN_HOVER = '#96AE00';
const GREEN_TINT = 'rgba(168,195,0,0.10)';

// Labels KA uses on its own action buttons — we clone one of these buttons'
// CSS classes so ours inherit KA's exact padding/typography/shape (100% match),
// then tint green. Falls back to a hand-built outlined style if none found.
const KA_BUTTON_LABELS = ['Bearbeiten', 'Aktivieren', 'Löschen', 'Verlängern', 'Hochladen', 'Pausieren', 'Teilen'];

function findRefButtonClass(scope: HTMLElement): string | null {
  const candidates = scope.querySelectorAll<HTMLElement>('a, button');
  for (const el of Array.from(candidates)) {
    const txt = (el.textContent || '').trim();
    if (el.className && KA_BUTTON_LABELS.some((l) => txt === l || txt.startsWith(l))) {
      return el.className;
    }
  }
  return null;
}

function alive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function bg<T = any>(message: any): Promise<T | null> {
  return new Promise((resolve) => {
    if (!alive()) return resolve(null);
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(resp);
      });
    } catch { resolve(null); }
  });
}

// ─── Repost cooldown (client-side anti-spam guard) ──────────────────────────

function getRepostLog(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(REPOST_LOG_KEY) || '{}'); } catch { return {}; }
}
function setReposted(adId: string) {
  const log = getRepostLog();
  log[adId] = Date.now();
  try { localStorage.setItem(REPOST_LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
}
function hoursSinceRepost(adId: string): number | null {
  const ts = getRepostLog()[adId];
  if (!ts) return null;
  return (Date.now() - ts) / 3_600_000;
}

// ─── Card / id detection (resilient to KA layout) ───────────────────────────

function findAdCards(): { card: HTMLElement; adId: string }[] {
  const out: { card: HTMLElement; adId: string }[] = [];
  const seen = new Set<string>();

  // Strategy 1: explicit data attribute (KA manage page uses data-adid).
  document.querySelectorAll<HTMLElement>('[data-adid]').forEach((el) => {
    const id = el.getAttribute('data-adid');
    if (id && !seen.has(id)) { seen.add(id); out.push({ card: el, adId: id }); }
  });

  // Strategy 2: fall back to ad links /s-anzeige/.../<digits>, climb to card.
  if (out.length === 0) {
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/s-anzeige/"]').forEach((a) => {
      const m = a.href.match(/\/(\d{6,})(?:[/?#]|$)/);
      if (!m) return;
      const id = m[1];
      if (seen.has(id)) return;
      const card = (a.closest('article, li, .cardbox, [class*="card" i]') as HTMLElement) || a.parentElement;
      if (card) { seen.add(id); out.push({ card, adId: id }); }
    });
  }
  return out;
}

function scrapeAdText(card: HTMLElement): { title: string; description: string } {
  const titleEl = card.querySelector('h2, h3, a[href*="/s-anzeige/"], [class*="title" i]');
  const descEl = card.querySelector('p, [class*="description" i], [class*="text" i]');
  return {
    title: (titleEl?.textContent || '').trim().slice(0, 120),
    description: (descEl?.textContent || '').trim().slice(0, 400),
  };
}

// ─── Small UI helpers ───────────────────────────────────────────────────────

function makeBtn(label: string, refClass: string | null): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;

  if (refClass) {
    // Inherit KA's exact button shape/typography, then apply a green tint.
    b.className = refClass;
    b.style.setProperty('color', GREEN, 'important');
    b.style.setProperty('border-color', GREEN, 'important');
    b.style.setProperty('background', 'transparent', 'important');
    b.style.cursor = 'pointer';
    b.onmouseenter = () => {
      b.style.setProperty('background', GREEN_TINT, 'important');
      b.style.setProperty('color', GREEN_HOVER, 'important');
      b.style.setProperty('border-color', GREEN_HOVER, 'important');
    };
    b.onmouseleave = () => {
      b.style.setProperty('background', 'transparent', 'important');
      b.style.setProperty('color', GREEN, 'important');
      b.style.setProperty('border-color', GREEN, 'important');
    };
  } else {
    // Fallback: outlined green, KA-like dimensions.
    Object.assign(b.style, {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '8px 12px', borderRadius: '6px',
      background: 'transparent', border: `1px solid ${GREEN}`, color: GREEN,
      cursor: 'pointer', fontSize: '14px', fontWeight: '500',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      whiteSpace: 'nowrap', transition: 'all 0.15s', lineHeight: '1',
    } as CSSStyleDeclaration);
    b.onmouseenter = () => { b.style.background = GREEN_TINT; b.style.borderColor = GREEN_HOVER; b.style.color = GREEN_HOVER; };
    b.onmouseleave = () => { b.style.background = 'transparent'; b.style.borderColor = GREEN; b.style.color = GREEN; };
  }
  return b;
}

function toast(msg: string, isError = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2147483647', background: isError ? '#dc2626' : '#1f2937', color: '#fff',
    padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
    fontFamily: 'system-ui, sans-serif', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', maxWidth: '320px',
  } as CSSStyleDeclaration);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ─── Actions ────────────────────────────────────────────────────────────────

async function doRepost(adId: string, btn: HTMLButtonElement) {
  const since = hoursSinceRepost(adId);
  if (since !== null && since < REPOST_COOLDOWN_HOURS) {
    const wait = Math.ceil(REPOST_COOLDOWN_HOURS - since);
    toast(`Diese Anzeige wurde gerade neu gestellt. Bitte ${wait} Std. warten (Spam-Schutz).`, true);
    return;
  }
  const ok = window.confirm(
    'Anzeige jetzt neu stellen?\n\nDie Anzeige wird gelöscht und neu erstellt, damit sie wieder oben erscheint. ' +
    'Zu häufiges Neustellen kann von Kleinanzeigen als Spam gewertet werden.',
  );
  if (!ok) return;

  const original = btn.textContent;
  btn.textContent = '⏳ Wird neu gestellt…';
  btn.disabled = true;
  const resp = await bg<{ success?: boolean; error?: string }>({ type: 'REPOST_AD', adId });
  btn.disabled = false;
  btn.textContent = original;

  if (resp?.success) {
    setReposted(adId);
    toast('✅ Anzeige wird neu gestellt.');
  } else if (resp?.error === 'NOT_CONNECTED') {
    toast('Nicht verbunden — bitte Sitzung im Popup übertragen.', true);
  } else {
    toast(`Fehler: ${resp?.error || 'Neu stellen fehlgeschlagen.'}`, true);
  }
}

async function doRewrite(card: HTMLElement, anchor: HTMLElement) {
  closeVariantPopover();
  const { title, description } = scrapeAdText(card);
  if (!title) { toast('Titel der Anzeige nicht gefunden.', true); return; }

  const pop = buildVariantPopover(anchor);
  pop.innerHTML = `<div style="padding:10px 8px;color:#6b7280;">✨ KI generiert 3 Vorschläge…</div>`;

  const resp = await bg<{ variants?: { title: string; description: string }[]; error?: string }>(
    { type: 'REWRITE_AD', title, description },
  );
  if (!document.body.contains(pop)) return;

  if (!resp || resp.error) {
    pop.innerHTML = `<div style="padding:10px 8px;color:#dc2626;line-height:1.4;">${
      resp?.error === 'NOT_CONNECTED'
        ? 'Nicht verbunden — bitte Sitzung im Popup übertragen.'
        : `Fehler: ${resp?.error || 'KI nicht erreichbar.'}`
    }</div>`;
    return;
  }
  const variants = resp.variants || [];
  if (variants.length === 0) { pop.innerHTML = `<div style="padding:10px 8px;color:#6b7280;">Keine Vorschläge erhalten.</div>`; return; }

  pop.innerHTML = '';
  const header = document.createElement('div');
  header.textContent = 'KI-Vorschläge — zum Kopieren klicken';
  Object.assign(header.style, { padding: '4px 8px 8px', fontWeight: '700', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' } as CSSStyleDeclaration);
  pop.appendChild(header);

  variants.forEach((v, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    Object.assign(item.style, { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: '7px', padding: '8px 10px', cursor: 'pointer', color: '#1f2937' } as CSSStyleDeclaration);
    item.onmouseenter = () => (item.style.background = '#f5f3ff');
    item.onmouseleave = () => (item.style.background = 'transparent');
    const t = document.createElement('div');
    t.textContent = `${i + 1}. ${v.title}`;
    t.style.fontWeight = '600'; t.style.marginBottom = '2px';
    const d = document.createElement('div');
    d.textContent = v.description;
    Object.assign(d.style, { fontSize: '11.5px', color: '#6b7280', lineHeight: '1.35' } as CSSStyleDeclaration);
    item.appendChild(t); item.appendChild(d);
    item.onclick = () => {
      navigator.clipboard.writeText(`${v.title}\n\n${v.description}`).then(
        () => toast('📋 Vorschlag kopiert — in „Anzeige bearbeiten“ einfügen.'),
        () => toast('Kopieren fehlgeschlagen.', true),
      );
      closeVariantPopover();
    };
    pop.appendChild(item);
  });
}

function openDashboard(adId: string) {
  const url = `${DASHBOARD_BASE}/meine-anzeigen?ad=${encodeURIComponent(adId)}`;
  window.open(url, '_blank', 'noopener');
}

// ─── Variant popover ─────────────────────────────────────────────────────────

const VARIANT_POP_ID = 'anzeigenboost-variant-popover';
function closeVariantPopover() {
  document.getElementById(VARIANT_POP_ID)?.remove();
  document.removeEventListener('click', onVariantOutside, true);
}
function onVariantOutside(e: MouseEvent) {
  const pop = document.getElementById(VARIANT_POP_ID);
  if (pop && !pop.contains(e.target as Node)) closeVariantPopover();
}
function buildVariantPopover(anchor: HTMLElement): HTMLElement {
  const pop = document.createElement('div');
  pop.id = VARIANT_POP_ID;
  Object.assign(pop.style, {
    position: 'fixed', zIndex: '2147483647', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: '320px',
    maxHeight: '360px', overflowY: 'auto', padding: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px', color: '#1f2937',
  } as CSSStyleDeclaration);
  const rect = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 332))}px`;
  if (rect.bottom + 360 > window.innerHeight && rect.top > 360) {
    pop.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  } else {
    pop.style.top = `${rect.bottom + 6}px`;
  }
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', onVariantOutside, true), 0);
  return pop;
}

// ─── Injection ────────────────────────────────────────────────────────────────

function injectInto(card: HTMLElement, adId: string) {
  if (card.querySelector(`[${MARKER}]`)) return; // already injected

  const bar = document.createElement('div');
  bar.setAttribute(MARKER, '1');
  Object.assign(bar.style, {
    display: 'flex', gap: '6px', flexWrap: 'wrap',
    padding: '8px 0 2px', marginTop: '6px',
  } as CSSStyleDeclaration);

  // Clone KA's own button class (from this card, falling back to the page) so
  // ours match 100%; then tint green.
  const refClass = findRefButtonClass(card) || findRefButtonClass(document.body);

  const reschedule = makeBtn('↻ Neu stellen', refClass);
  reschedule.onclick = (e) => { e.preventDefault(); e.stopPropagation(); doRepost(adId, reschedule); };

  const ai = makeBtn('⚡ KI-Inhalt', refClass);
  ai.onclick = (e) => { e.preventDefault(); e.stopPropagation(); doRewrite(card, ai); };

  const dash = makeBtn('⊞ Dashboard', refClass);
  dash.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openDashboard(adId); };

  bar.appendChild(reschedule);
  bar.appendChild(ai);
  bar.appendChild(dash);
  card.appendChild(bar);
}

function tick() {
  findAdCards().forEach(({ card, adId }) => injectInto(card, adId));
}

function isMyAdsPage(): boolean {
  return /m-meine-anzeigen/i.test(location.pathname);
}

export function startMyAds() {
  if (!isMyAdsPage()) return;
  tick();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; if (isMyAdsPage()) tick(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
