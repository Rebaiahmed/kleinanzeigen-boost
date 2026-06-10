/**
 * Kleinanzeigen in-page content script.
 *
 * Feature: "📋 Vorlage einfügen" — injects a button next to the message
 * composer on the Nachrichten page. Clicking it shows the seller's saved
 * reply templates; picking one inserts its text into the message field.
 *
 * Design principles:
 * - User-initiated only. Never auto-sends a message.
 * - No bulk actions. Zero anti-spam risk.
 * - Token never leaves the background worker (we ask it for templates).
 * - All features gated by FEATURES flags.
 */
import { FEATURES } from '../config/features';
import { startMyAds } from './my-ads';

let lastComposer: HTMLElement | null = null;

const BTN_ID = 'anzeigenboost-vorlage-btn';
const POS_KEY = 'anzeigenboost-btn-pos-v2';
const HINT_KEY = 'anzeigenboost-hint-seen';
const POPOVER_ID = 'anzeigenboost-vorlage-popover';
// Kleinanzeigen brand green — keeps the injected UI native to the site.
const KA_GREEN = '#A8C300';
const KA_GREEN_HOVER = '#96AE00';

interface ReplyTemplate {
  id?: string;
  icon: string;
  title: string;
  content: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isExtensionAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function fetchTemplates(): Promise<{ success: boolean; templates?: ReplyTemplate[]; error?: string }> {
  return new Promise((resolve) => {
    if (!isExtensionAlive()) {
      resolve({ success: false, error: 'CONTEXT_INVALID' });
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'FETCH_REPLY_TEMPLATES' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ success: false, error: 'CONTEXT_INVALID' });
        } else {
          resolve(response);
        }
      });
    } catch {
      resolve({ success: false, error: 'CONTEXT_INVALID' });
    }
  });
}

/**
 * Insert text into a message field that may be a <textarea>, an <input>, or a
 * contenteditable. Uses the native setter + dispatched events so React-managed
 * inputs (KA's composer) pick up the change.
 */
function insertIntoField(field: HTMLElement, text: string) {
  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    const proto = field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
  } else if (field.isContentEditable) {
    field.focus();
    field.textContent = text;
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}

/** Find the message composer on the Nachrichten page (resilient to layout). */
function findComposer(): HTMLElement | null {
  // Prefer an explicit textarea inside the conversation/message form.
  const selectors = [
    'textarea[name*="message" i]',
    'textarea[placeholder*="Nachricht" i]',
    'form textarea',
    'textarea',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.offsetParent !== null) return el; // visible
  }
  return null;
}

// ─── Popover ────────────────────────────────────────────────────────────────

function closePopover() {
  document.getElementById(POPOVER_ID)?.remove();
  document.removeEventListener('click', onOutsideClick, true);
}

function onOutsideClick(e: MouseEvent) {
  const pop = document.getElementById(POPOVER_ID);
  const btn = document.getElementById(BTN_ID);
  if (pop && !pop.contains(e.target as Node) && e.target !== btn && !btn?.contains(e.target as Node)) {
    closePopover();
  }
}

/** Fire-and-forget usage tracking — reuses the copy-count endpoint so the
 *  dashboard can show which templates are actually used in real chats. */
function trackTemplateUse(id?: string) {
  if (!id || !isExtensionAlive()) return;
  try {
    chrome.runtime.sendMessage({ type: 'TRACK_TEMPLATE_USE', id }, () => void chrome.runtime.lastError);
  } catch { /* context gone */ }
}

function triggerConnect() {
  if (!isExtensionAlive()) return;
  try {
    chrome.runtime.sendMessage({ type: 'INIT_HANDSHAKE' }, () => {
      closePopover();
    });
  } catch { /* context gone */ }
}

function renderPopover(anchor: HTMLElement, composer: HTMLElement) {
  closePopover();

  const pop = document.createElement('div');
  pop.id = POPOVER_ID;
  Object.assign(pop.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
    width: '300px',
    maxHeight: '340px',
    overflowY: 'auto',
    padding: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    color: '#1f2937',
  } as CSSStyleDeclaration);

  // Anchor the popover to the button, opening downward if the button is in the
  // upper half of the viewport, upward otherwise — so it's always on screen.
  const rect = anchor.getBoundingClientRect();
  pop.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  if (rect.top < window.innerHeight / 2) {
    pop.style.top = `${rect.bottom + 8}px`;
  } else {
    pop.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  }

  const setBody = (html: string) => { pop.innerHTML = html; };

  setBody(`<div style="padding:10px 8px;color:#6b7280;">Lade Vorlagen…</div>`);
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', onOutsideClick, true), 0);

  fetchTemplates().then((res) => {
    if (!document.getElementById(POPOVER_ID)) return; // closed meanwhile

    if (!res.success) {
      if (res.error === 'NOT_CONNECTED') {
        pop.innerHTML = '';
        const msg = document.createElement('div');
        msg.textContent = 'Noch nicht verbunden. Übertrage deine Kleinanzeigen-Sitzung, um deine Vorlagen zu laden.';
        Object.assign(msg.style, { padding: '8px', color: '#374151', lineHeight: '1.45' } as CSSStyleDeclaration);
        const connectBtn = document.createElement('button');
        connectBtn.type = 'button';
        connectBtn.textContent = '🔗 Sitzung übertragen';
        Object.assign(connectBtn.style, {
          display: 'block', width: '100%', margin: '4px 0 2px', padding: '9px',
          background: KA_GREEN, color: '#fff', border: 'none', borderRadius: '8px',
          cursor: 'pointer', fontSize: '13px', fontWeight: '600',
        } as CSSStyleDeclaration);
        connectBtn.onclick = triggerConnect;
        pop.appendChild(msg);
        pop.appendChild(connectBtn);
        return;
      }
      const msg = res.error === 'CONTEXT_INVALID'
        ? 'Erweiterung neu geladen — bitte Seite aktualisieren.'
        : `Fehler beim Laden (${res.error}).`;
      setBody(`<div style="padding:10px 8px;color:#dc2626;line-height:1.4;">${msg}</div>`);
      return;
    }

    const templates = res.templates || [];
    if (templates.length === 0) {
      setBody(`<div style="padding:10px 8px;color:#6b7280;line-height:1.4;">Noch keine Vorlagen. Im Dashboard unter „Antwort-Vorlagen“ erstellen.</div>`);
      return;
    }

    pop.innerHTML = '';
    const header = document.createElement('div');
    header.textContent = 'Vorlage einfügen';
    Object.assign(header.style, {
      padding: '4px 8px 8px', fontWeight: '700', fontSize: '11px',
      color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em',
    } as CSSStyleDeclaration);
    pop.appendChild(header);

    templates.forEach((t) => {
      const item = document.createElement('button');
      item.type = 'button';
      Object.assign(item.style, {
        display: 'block', width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none', borderRadius: '7px',
        padding: '8px 10px', cursor: 'pointer', color: '#1f2937',
      } as CSSStyleDeclaration);
      item.onmouseenter = () => (item.style.background = '#f1f5f9');
      item.onmouseleave = () => (item.style.background = 'transparent');

      const title = document.createElement('div');
      title.textContent = `${t.icon || '📋'}  ${t.title}`;
      title.style.fontWeight = '600';
      title.style.marginBottom = '2px';

      const preview = document.createElement('div');
      preview.textContent = t.content;
      Object.assign(preview.style, {
        fontSize: '11.5px', color: '#6b7280', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      } as CSSStyleDeclaration);

      item.appendChild(title);
      item.appendChild(preview);
      item.onclick = () => {
        insertIntoField(composer, t.content);
        trackTemplateUse(t.id);
        closePopover();
      };
      pop.appendChild(item);
    });
  });
}

// ─── Button injection ─────────────────────────────────────────────────────────

function injectButton(composer: HTMLElement) {
  if (document.getElementById(BTN_ID)) return; // already injected

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.textContent = '📋 Vorlage einfügen';
  btn.title = 'Klicken zum Einfügen · Ziehen zum Verschieben';
  Object.assign(btn.style, {
    position: 'fixed',
    right: '20px',
    top: '110px',
    zIndex: '2147483646',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px',
    background: KA_GREEN, color: '#fff', border: 'none',
    borderRadius: '24px', cursor: 'pointer',
    fontSize: '13px', fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 4px 14px rgba(9,177,186,0.4)',
  } as CSSStyleDeclaration);
  btn.onmouseenter = () => { if (!dragging) btn.style.background = KA_GREEN_HOVER; };
  btn.onmouseleave = () => { if (!dragging) btn.style.background = KA_GREEN; };

  // Restore a saved position if the user dragged it before.
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      btn.style.left = `${saved.left}px`;
      btn.style.top = `${saved.top}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  } catch { /* ignore */ }

  // ─── Drag-to-reposition (distinguishes a click from a drag) ───
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    const left = Math.min(window.innerWidth - btn.offsetWidth - 4, Math.max(4, originLeft + dx));
    const top = Math.min(window.innerHeight - btn.offsetHeight - 4, Math.max(4, originTop + dy));
    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    btn.style.background = KA_GREEN;
    if (moved) {
      const rect = btn.getBoundingClientRect();
      try { localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top })); } catch { /* ignore */ }
    }
  };
  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  });

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (moved) { moved = false; return; } // was a drag, not a click
    if (document.getElementById(POPOVER_ID)) {
      closePopover();
    } else {
      renderPopover(btn, findComposer() || lastComposer || composer);
    }
  };

  // Floating action button — independent of KA's layout, so it never breaks
  // when KA redesigns the composer. Keep a reference to the live composer.
  lastComposer = composer;
  document.body.appendChild(btn);

  showFirstVisitHint(btn);
}

/** One-time discoverability nudge so first-time users notice the button. */
function showFirstVisitHint(btn: HTMLElement) {
  try {
    if (localStorage.getItem(HINT_KEY)) return;
  } catch { return; }

  const tip = document.createElement('div');
  tip.textContent = '💡 Schneller antworten – mit gespeicherten Vorlagen';
  Object.assign(tip.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: '#1f2937',
    color: '#fff',
    padding: '9px 12px',
    borderRadius: '8px',
    fontSize: '12.5px',
    fontWeight: '500',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '220px',
    lineHeight: '1.4',
    boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
    cursor: 'pointer',
  } as CSSStyleDeclaration);

  const rect = btn.getBoundingClientRect();
  tip.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  tip.style.top = `${rect.bottom + 10}px`;

  const dismiss = () => {
    tip.remove();
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
  };
  tip.onclick = dismiss;
  document.body.appendChild(tip);
  setTimeout(dismiss, 7000); // auto-dismiss; only ever shown once
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function isMessagesPage(): boolean {
  return /m-nachrichten|nachrichten|messages/i.test(location.pathname);
}

function tick() {
  if (!isMessagesPage()) {
    // Clean up if user navigated away within the SPA.
    document.getElementById(BTN_ID)?.remove();
    closePopover();
    return;
  }
  const composer = findComposer();
  if (composer) {
    lastComposer = composer;
    injectButton(composer);
  }
}

function start() {
  if (FEATURES.REPLY_TEMPLATE_INJECTION) {
    tick();
    // KA is a SPA — re-check on DOM mutations (debounced via rAF).
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        tick();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (FEATURES.AD_ACTION_BUTTONS) {
    startMyAds();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

console.log('[AnzeigenBoost] KA content script loaded — build: outlined-green-v3');
