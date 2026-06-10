/**
 * POC — Facebook Marketplace repost/renew (feature-flagged OFF by default).
 *
 * GOAL
 *   Explore whether AnzeigenBoost can offer a "Neu stellen" (push-to-top) action
 *   for a seller's own Facebook Marketplace listings, the same value prop we
 *   give on Kleinanzeigen.
 *
 * HONEST CONSTRAINTS (see docs/POC-facebook-marketplace-repost.md)
 *   - FB has NO public listing API for individuals. Everything is DOM-driven.
 *   - FB's UI is React with obfuscated, frequently-changing class names and
 *     ARIA labels that are localized — selectors break often.
 *   - Rapid create/delete/renew trips FB's anti-spam → checkpoints/bans. This
 *     must stay strictly user-initiated, one listing at a time, with cooldowns.
 *   - Photos cannot be programmatically re-attached from a normal web page, but
 *     CAN be from an extension content script (DataTransfer) — relevant only if
 *     we ever do full delete-and-relist rather than FB's native "Renew".
 *
 * APPROACH (lowest-risk first)
 *   Tier 1 (this POC): surface FB's OWN "Renew"/"Mark as available" control when
 *     it exists, and one-click it. We are not creating/deleting anything — just
 *     automating a button FB already offers. Much lower ban risk.
 *   Tier 2 (future): delete-and-relist for listings FB won't renew. Higher risk;
 *     gated separately and out of scope for this POC.
 *
 * STATUS: scaffold only. Selectors are best-guess and will need to be confirmed
 * against the live DOM (logged to console when the flag is on).
 */
import { FEATURES } from '../config/features';

const BTN_MARKER = 'data-anzeigenboost-fb-renew';
const COOLDOWN_KEY = 'anzeigenboost-fb-renew-log';
const COOLDOWN_HOURS = 24; // FB is stricter than KA — keep this conservative.

function isMarketplaceListingsPage(): boolean {
  // e.g. facebook.com/marketplace/you/selling
  return /facebook\.com$/.test(location.hostname.replace(/^www\./, '')) &&
    /\/marketplace\/(you|selling)/i.test(location.pathname);
}

// ─── Cooldown guard ───────────────────────────────────────────────────────────

function getLog(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}'); } catch { return {}; }
}
function markRenewed(key: string) {
  const log = getLog();
  log[key] = Date.now();
  try { localStorage.setItem(COOLDOWN_KEY, JSON.stringify(log)); } catch { /* ignore */ }
}
function hoursSince(key: string): number | null {
  const ts = getLog()[key];
  return ts ? (Date.now() - ts) / 3_600_000 : null;
}

// ─── Listing detection (BEST-GUESS — confirm against live DOM) ──────────────────

interface FbListing { card: HTMLElement; key: string; renewControl: HTMLElement | null; }

function findListings(): FbListing[] {
  const out: FbListing[] = [];
  // FB renders each listing as a link to /marketplace/item/<id>. Climb to the card.
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/marketplace/item/"]').forEach((a) => {
    const m = a.href.match(/\/marketplace\/item\/(\d+)/);
    if (!m) return;
    const key = m[1];
    const card = (a.closest('[role="article"], li, [class*="x1n2onr6"]') as HTMLElement) || a.parentElement;
    if (!card || card.querySelector(`[${BTN_MARKER}]`)) return;
    // FB sometimes exposes a native "Renew listing" / "Erneut anbieten" item.
    const renewControl = findRenewControl(card);
    out.push({ card, key, renewControl });
  });
  return out;
}

/** Look for FB's own renew/relist control by its (localized) accessible text. */
function findRenewControl(scope: HTMLElement): HTMLElement | null {
  const RENEW_LABELS = [/renew/i, /erneut anbieten/i, /wieder verfügbar/i, /mark as available/i];
  const candidates = scope.querySelectorAll<HTMLElement>('[role="button"], button, a, span');
  for (const el of Array.from(candidates)) {
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim();
    if (txt && RENEW_LABELS.some((re) => re.test(txt))) return el;
  }
  return null;
}

// ─── Injection ──────────────────────────────────────────────────────────────

function injectRenewButton(listing: FbListing) {
  const btn = document.createElement('button');
  btn.setAttribute(BTN_MARKER, '1');
  btn.type = 'button';
  btn.textContent = '🔄 Neu stellen';
  Object.assign(btn.style, {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', margin: '6px 0', border: '1px solid #1877f2',
    borderRadius: '6px', background: 'transparent', color: '#1877f2',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as CSSStyleDeclaration);

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const since = hoursSince(listing.key);
    if (since !== null && since < COOLDOWN_HOURS) {
      alert(`Diese Anzeige wurde gerade neu gestellt. Bitte ${Math.ceil(COOLDOWN_HOURS - since)} Std. warten (Facebook-Spam-Schutz).`);
      return;
    }
    if (!confirm('Anzeige bei Facebook neu stellen?\n\nFacebook kann häufiges Neustellen als Spam werten — bitte sparsam verwenden.')) return;

    if (listing.renewControl) {
      // Tier 1: click FB's OWN renew control. Lowest risk — we automate a button
      // FB already provides, we don't create or delete anything.
      (listing.renewControl as HTMLElement).click();
      markRenewed(listing.key);
      console.log('[AnzeigenBoost][FB POC] Clicked native renew for', listing.key);
    } else {
      // Tier 2 (delete-and-relist) is intentionally NOT implemented in this POC.
      alert('Für diese Anzeige bietet Facebook aktuell kein direktes „Erneut anbieten“. ' +
        'Delete-and-Relist ist im POC bewusst nicht aktiviert (Ban-Risiko).');
      console.warn('[AnzeigenBoost][FB POC] No native renew control found for', listing.key);
    }
  };

  listing.card.appendChild(btn);
}

function tick() {
  findListings().forEach(injectRenewButton);
}

export function startFacebookMarketplace() {
  if (!FEATURES.FACEBOOK_MARKETPLACE_REPOST) return;
  if (!isMarketplaceListingsPage()) return;

  console.log('[AnzeigenBoost][FB POC] Facebook Marketplace repost POC active. ' +
    'Selectors are best-guess — verify against live DOM.');
  tick();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; tick(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
