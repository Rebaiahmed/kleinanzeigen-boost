// Background service worker — MV3 compatible, no persistent WebSocket
// Sync is extension-initiated: frontend triggers TRIGGER_SYNC → background
// fetches ads from Kleinanzeigen → POSTs to backend.
import { ENDPOINTS } from '../config/endpoints';
import { executeRepostFullFlow, registerOverlayScript, unregisterOverlayScript } from './repost-engine';
import { collectAdPages } from './sync-pagination';
import { computeNextSmartRepost, applySmartVariation } from '../config/smart-repost';

const API_URL = ENDPOINTS.API_BASE;

// ─── Credits (feature-flagged; backend is the source of truth) ───────────────
// Both helpers are safe to call unconditionally — when ENABLE_CREDITS is off,
// the backend returns CREDITS_DISABLED and reserveCredits treats that as "not
// gated, proceed" rather than a real insufficient-balance block, so callers
// never need to check the flag themselves.

/** Reserves (deducts) credits for one repost before it runs. Returns
 *  ok:true if the repost should proceed (either credits were reserved, or
 *  the feature is disabled and nothing is gated); ok:false + a user-facing
 *  error only for a genuine insufficient-balance block. */
async function reserveCredits(
  token: string,
  actionType: 'repost' | 'smart_repost',
  relatedActionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/credits/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actionType, relatedActionId }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    if (data.code === 'CREDITS_DISABLED') return { ok: true }; // flag off — not gated
    if (data.code === 'INSUFFICIENT_CREDITS') return { ok: false, error: 'Nicht genügend Credits. Bitte Credits aufladen.' };
    console.warn('[BG][credits] reserve failed:', data.message || res.status);
    return { ok: true }; // fail open — a credits-plumbing error must never block a real repost
  } catch (e: any) {
    console.warn('[BG][credits] reserve error:', e.message);
    return { ok: true }; // fail open (network hiccup etc.)
  }
}

/** Reports how the reserved repost turned out. Best-effort — if this never
 *  arrives (extension crash), the backend's stale-reservation cleanup cron
 *  auto-refunds within 10 minutes. */
function confirmCredits(token: string, relatedActionId: string, success: boolean): void {
  fetch(`${API_URL}/credits/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ relatedActionId, success }),
  }).catch((e) => console.warn('[BG][credits] confirm error:', e.message));
}

// Self-heal a stuck overlay registration. registerOverlayScript()/
// unregisterOverlayScript() are only ever paired inside performRepost()'s
// callback chain (see below) — if the MV3 service worker is killed mid-repost
// (Chrome can terminate it during a long-running flow with many sequential
// awaits), unregisterOverlayScript() never runs. The MAIN-world 'ab-overlay-
// paint' content script then stays registered on every kleinanzeigen.de page
// for the rest of the browser session (persistAcrossSessions:false only
// clears it on a full Chrome restart), breaking every subsequent repost and
// any other MAIN-world script injection on that origin. The service worker
// restarts frequently under MV3, so running this at top-level module scope
// clears any orphaned registration shortly after the failure, without
// requiring the user to restart their browser.
unregisterOverlayScript().catch(() => {});

// Cross-tab safety net: only ONE instant repost may run at a time. The frontend
// queue normally serializes clicks, but this guard prevents a second parallel
// repost (e.g. from a second dashboard tab) from ever starting.
let repostBusy = false;

// Client-side scheduler: the extension is the PRIMARY repost path — it runs due
// reposts from the user's real browser/IP (no datacenter IP ban). The server is
// only a fallback after a grace window (see scheduler.constants).
const CLIENT_SCHEDULER_ENABLED = true;
let clientSchedulerRunning = false;

/**
 * Run ONE repost in a fresh background tab (shared by the manual "Jetzt" trigger
 * and the client scheduler). Honours the single-runner busy guard, shows the
 * branded overlay, and resolves with the flow result.
 */
function performRepost(adId: string, adData: any): Promise<{ ok: boolean; step?: string; finalUrl?: string; error?: string; busy?: boolean }> {
  return new Promise((resolve) => {
    if (repostBusy) { resolve({ ok: false, busy: true, error: 'Es läuft bereits ein Repost' }); return; }
    repostBusy = true;
    registerOverlayScript().finally(() => {
      chrome.tabs.create({ url: 'https://www.kleinanzeigen.de/#ab-repost-start' }, (newTab) => {
        if (!newTab?.id) {
          unregisterOverlayScript();
          repostBusy = false;
          resolve({ ok: false, error: 'failed to create new tab' });
          return;
        }
        setTimeout(() => {
          executeRepostFullFlow(newTab.id!, adId, adData).then((result) => {
            const title = result.ok ? '✅ Anzeige neu eingestellt' : '❌ Neu einstellen fehlgeschlagen';
            const msg = result.ok
              ? `Deine Anzeige wurde erfolgreich neu eingestellt.\n${result.finalUrl || ''}`
              : `Bei Schritt "${result.step}": ${result.error}`;
            chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-128.png', title, message: msg.slice(0, 300) });
            resolve(result);
          }).catch((e) => {
            console.error('[BG] executeRepostFullFlow error:', e.message);
            resolve({ ok: false, error: e.message, step: 'unknown' });
          }).finally(() => {
            unregisterOverlayScript();
            repostBusy = false;
          });
        }, 1000);
      });
    });
  });
}

/**
 * Find due reposts and run them one at a time (with a jittered pause between),
 * from the user's real browser. Claims each ad so the server fallback skips it.
 * Runs on a 1-min alarm AND on browser startup (catch-up for schedules that came
 * due while Chrome was closed).
 */
async function runDueClientReposts(verbose = false): Promise<void> {
  if (!CLIENT_SCHEDULER_ENABLED || clientSchedulerRunning) return;
  const { token } = (await chrome.storage.session.get(['token'])) as { token?: string };
  if (!token) { if (verbose) console.warn('[BG][sched] no token — not connected'); return; }

  let ads: any[] = [];
  try {
    const res = await fetch(`${API_URL}/ads`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { if (verbose) console.warn('[BG][sched] /ads HTTP', res.status); return; }
    const data = await res.json();
    ads = data.ads || data.data || data || [];
  } catch (e: any) { if (verbose) console.warn('[BG][sched] fetch failed:', e.message); return; }

  const now = Date.now();
  const due = ads.filter((a) =>
    a.autoRepost === true &&
    a.nextRepostAt && new Date(a.nextRepostAt).getTime() <= now &&
    (!a.listingState || a.listingState === 'active'));
  if (due.length === 0) { if (verbose) console.log('[BG][sched] no due reposts'); return; }

  console.log(`[BG][sched] ${due.length} due repost(s) — claiming all up front, then reposting one at a time`);
  clientSchedulerRunning = true;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  try {
    // BATCH-CLAIM: advance nextRepostAt for ALL due ads up front, BEFORE reposting
    // any. Otherwise ads later in the queue stay "due" while we work through it one
    // at a time, and the server fallback (after its grace window) could grab and
    // repost them in parallel → duplicate listings. Claiming the whole batch first
    // mirrors the server's atomic lock across every due ad. Only successfully
    // claimed ads are reposted; a failed claim is skipped (avoids a double post).
    const claimed: any[] = [];
    for (const ad of due) {
      // Smart mode: claim the next slot before a peak (≥7 days out) and bump the
      // variation counter. Manual: interval.
      const smart = ad.repostMode === 'smart';
      const claimedNext = smart
        ? computeNextSmartRepost(Date.now())
        : new Date(Date.now() + (Number(ad.repostIntervalMinutes) || 1440) * 60000).toISOString();
      const claimBody: any = { nextRepostAt: claimedNext };
      if (smart) claimBody.trackedRepostsCount = (Number(ad.trackedRepostsCount) || 0) + 1;
      try {
        const claimRes = await fetch(`${API_URL}/ads/${ad.id}`, {
          method: 'PATCH', headers: authHeaders, body: JSON.stringify(claimBody),
        });
        if (claimRes.ok) claimed.push(ad);
        else console.warn(`[BG][sched] claim failed for ${ad.id} (HTTP ${claimRes.status}) — skipping to avoid double post`);
      } catch (e: any) {
        console.warn(`[BG][sched] claim error for ${ad.id} — skipping:`, e.message);
      }
    }

    // Now repost the claimed ads one at a time, jittered (human-like, lowers risk).
    for (let i = 0; i < claimed.length; i++) {
      const ad = claimed[i];
      const isSmart = ad.repostMode === 'smart';

      // Credits: reserve before running this ad's repost. Insufficient balance
      // skips just this ad (like the backend cron's equivalent skip) — the
      // rest of the batch still runs.
      const creditActionId = crypto.randomUUID();
      const reservation = await reserveCredits(token, isSmart ? 'smart_repost' : 'repost', creditActionId);
      if (!reservation.ok) {
        console.warn(`[BG][sched] skipping ${ad.id} — ${reservation.error}`);
        continue;
      }

      // Smart mode: apply one micro-variation to what gets posted (engine unchanged).
      const repostCount = Number(ad.trackedRepostsCount) || 0;
      const varied = isSmart
        ? applySmartVariation(ad, ad.smartVariation, repostCount)
        : { adData: ad, applied: 'none' as const };
      if (isSmart) console.log(`[BG][sched] smart variation for ${ad.id}: ${varied.applied}`);
      const result = await performRepost(String(ad.id), varied.adData);
      confirmCredits(token, creditActionId, result.ok);

      // On failure, pull nextRepostAt back to a short retry window (not the full
      // interval) so it retries soon — but not on the immediate next tick. The
      // claimed future value already stands on success, so no second PATCH there.
      if (!result.ok) {
        const retryAt = new Date(Date.now() + 10 * 60000).toISOString();
        try {
          await fetch(`${API_URL}/ads/${ad.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ nextRepostAt: retryAt }) });
        } catch { /* non-fatal — claimed value keeps it from looping */ }
      }

      if (i < claimed.length - 1) {
        await new Promise((r) => setTimeout(r, 4000 + Math.floor(Math.random() * 4000)));
      }
    }
  } finally {
    clientSchedulerRunning = false;
  }
}

// ─── Uninstall feedback form ──────────────────────────────────────────────────
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfWFO_imx_NLkCTGjphKV1gwogiHbZTxmjUEzVHma79n1gE_w/viewform';

function registerUninstallUrl() {
  chrome.runtime.setUninstallURL(FEEDBACK_FORM_URL, () => {
    if (chrome.runtime.lastError) {
      console.warn('[BG] Failed to set uninstall URL:', chrome.runtime.lastError.message);
    }
  });
}

// Register on extension startup (survives MV3 service worker restarts)
registerUninstallUrl();

// Also register on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    registerUninstallUrl();
  }
});

// ─── Periodic sync via alarms (wake-safe) ────────────────────────────────────

async function doSync(token: string): Promise<{ success: boolean; ads?: any[]; error?: string }> {
  // Kleinanzeigen paginates this endpoint at pageSize=25 (see `paging` in the
  // response). The old sync read only page 1, so accounts with >25 ads silently
  // lost everything past the first 25. Walk every page — throttled, so we don't
  // burst-hit KA and trip bot detection (Step 5). Logic lives in collectAdPages
  // so it can be unit-tested without a browser.
  const fetchPage = async (pageNum: number) => {
    const url = new URL(ENDPOINTS.MARKETPLACE_ADS_JSON);
    if (pageNum > 1) {
      // Set BOTH common page params — KA uses whichever it supports and ignores
      // the other. Robust without needing to verify the exact param name against
      // a real >25-ad account. (collectAdPages still stops if no new ads arrive.)
      url.searchParams.set('pageNum', String(pageNum));
      url.searchParams.set('page', String(pageNum));
    }
    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) throw new Error(`Kleinanzeigen returned ${res.status}`);
    return res.json();
  };

  const allAds = await collectAdPages(fetchPage, {
    delayMs: 500,
    log: (m) => console.log(`[BG]${m}`),
  });

  // NOTE: Kleinanzeigen list endpoint does NOT return description or photo URLs
  // - articles[] = add-on services (AD_BUMP_UP, etc), NOT the description
  // - imageCount = count of images, but not the URLs themselves
  // Description and photos would need to be fetched from individual ad pages

  const enrichedAds = allAds.map((ad: any) => {
    // Remove articles field (not needed - it's just add-on services)
    const { articles, ...adWithoutArticles } = ad;
    return adWithoutArticles;
  });

  const importRes = await fetch(`${API_URL}/ads/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ads: enrichedAds }),
  });
  const data = await importRes.json();
  if (!importRes.ok) throw new Error(data.message || `Import failed ${importRes.status}`);

  return { success: true, ads: data.ads || [] };
}

chrome.alarms.create('periodic-sync', { periodInMinutes: 30 });

// Client-side repost scheduler — runs due reposts from the user's real browser.
// Fires every minute while Chrome is open; onStartup catches up schedules that
// came due while Chrome was closed.
if (CLIENT_SCHEDULER_ENABLED) {
  chrome.alarms.create('client-repost-scheduler', { periodInMinutes: 1 });
  chrome.runtime.onStartup.addListener(() => {
    runDueClientReposts(true).catch((e) => console.warn('[BG][sched] startup run failed:', e.message));
  });
}

/** Pop an alert() on an open Kleinanzeigen tab (no OS-notification dependency). */
function alertOnKaTab(text: string) {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      console.warn('[BG][sim] tabs.query error:', chrome.runtime.lastError.message);
      return;
    }
    const t = tabs.find((tab) => /kleinanzeigen\.de/.test(tab.url || ''));
    if (t?.id) {
      chrome.tabs.sendMessage(t.id, { type: 'AB_SIM_ALERT', text }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BG][sim] sendMessage error:', chrome.runtime.lastError.message);
          return;
        }
      });
    } else {
      console.warn('[BG][sim] no open kleinanzeigen.de tab to show the alert');
    }
  });
}

async function runSimulatedScheduler(verbose = false) {
  const { token } = await chrome.storage.session.get(['token']);
  if (!token) { if (verbose) console.warn('[BG][sim] no token — not connected'); return; }
  let ads: any[] = [];
  try {
    const res = await fetch(`${API_URL}/ads`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { if (verbose) console.warn('[BG][sim] /ads HTTP', res.status); return; }
    const data = await res.json();
    ads = data.ads || data || [];
  } catch (e: any) { if (verbose) console.warn('[BG][sim] fetch failed:', e.message); return; }

  const now = Date.now();
  const due = ads.filter((a) =>
    a.autoRepost === true &&
    a.nextRepostAt && new Date(a.nextRepostAt).getTime() <= now &&
    (!a.listingState || a.listingState === 'active'),
  );
  if (due.length === 0) return;

  for (const ad of due) {
    const title = (ad.title || 'Deine Anzeige').replace(/<[^>]+>/g, '').slice(0, 60);
    chrome.notifications.create(`repost-sim-${ad.id}-${now}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: '✅ Anzeige neu gestellt (Simulation)',
      message: `„${title}" wäre jetzt neu eingestellt worden. (Test-Modus — es wurde nichts gepostet.)`,
    });
    // Also pop an alert on an open KA tab (works even if OS notifications are off).
    alertOnKaTab(`✅ Simulation: „${title}" wäre jetzt neu eingestellt worden. (Test — nichts gepostet)`);

    // Reschedule so it doesn't fire again immediately (mirrors real behaviour).
    const intervalMin = Number(ad.repostIntervalMinutes) || 1440;
    const next = new Date(now + intervalMin * 60 * 1000).toISOString();
    try {
      await fetch(`${API_URL}/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextRepostAt: next }),
      });
    } catch { /* non-fatal in test mode */ }
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodic-sync') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) return;
      try { await doSync(token); }
      catch (e: any) { console.warn('[BG] Periodic sync failed:', e.message); }
    });
  } else if (alarm.name === 'repost-sim-check') {
    runSimulatedScheduler().catch((e) => console.warn('[BG][sim] failed:', e.message));
  } else if (alarm.name === 'client-repost-scheduler') {
    runDueClientReposts().catch((e) => console.warn('[BG][sched] failed:', e.message));
  }
});

// ─── Handshake helpers ────────────────────────────────────────────────────────

function openCallbackTab(token: string) {
  // Open directly with token — no intermediate blank page
  chrome.tabs.create({ url: `${ENDPOINTS.DASHBOARD_AUTH_CALLBACK}?token=${token}` });
}

function initiateHandshake(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: ENDPOINTS.MARKETPLACE_DOMAIN }, (cookies) => {
      if (chrome.runtime.lastError) {
        return resolve({ success: false, error: chrome.runtime.lastError.message });
      }
      if (!cookies?.length) {
        return resolve({ success: false, error: 'Keine Kleinanzeigen Cookies gefunden. Bitte auf kleinanzeigen.de einloggen.' });
      }
      fetch(`${API_URL}/auth/handshake-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.token) { openCallbackTab(data.token); resolve({ success: true }); }
          else resolve({ success: false, error: data.message || 'Token Generierung fehlgeschlagen.' });
        })
        .catch(err => resolve({ success: false, error: 'Serverfehler: ' + err.message }));
    });
  });
}

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {

  // Triggered by sync button — fetch ads and import to backend
  if (message.type === 'TRIGGER_SYNC') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) {
        sendResponse({ success: false, error: 'No session token — please reconnect.' });
        return;
      }
      try {
        const result = await doSync(token);
        sendResponse(result);
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Store JWT token in session storage (called after login)
  if (message.type === 'STORE_SESSION_TOKEN') {
    chrome.storage.session.set({ token: message.token }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[BG] storage.session.set error:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ success: true });
    });
    return true;
  }

  // Get JWT token from session storage (used by content scripts)
  if (message.type === 'GET_SESSION_TOKEN') {
    chrome.storage.session.get(['token'], ({ token }: any) => {
      if (chrome.runtime.lastError) {
        console.warn('[BG] storage.session.get error:', chrome.runtime.lastError.message);
        sendResponse({ token: null });
        return;
      }
      if (token) {
        sendResponse({ token });
      } else {
        // Fallback: try to get from local storage (for development)
        chrome.storage.local.get(['token'], ({ token: localToken }: any) => {
          if (chrome.runtime.lastError) {
            console.warn('[BG] storage.local.get error:', chrome.runtime.lastError.message);
            sendResponse({ token: null });
            return;
          }
          sendResponse({ token: localToken || null });
        });
      }
    });
    return true;
  }

  // Check if user is logged into a platform.
  // For Kleinanzeigen we validate an ACTUAL authenticated session (a valid,
  // non-expired access_token JWT) — not mere cookie presence, because KA keeps
  // consent/analytics cookies after logout, which used to show a false "logged in".
  if (message.type === 'CHECK_PLATFORM_LOGIN') {
    const domains: Record<string, string> = {
      kleinanzeigen: 'kleinanzeigen.de',
      vinted: 'vinted.de',
      ebay: 'ebay.de',
    };
    const domain = domains[message.platform] || '';
    chrome.cookies.getAll({ domain }, (cookies) => {
      if (message.platform !== 'kleinanzeigen') {
        // Other platforms keep the previous heuristic for now.
        sendResponse({ isLoggedIn: cookies.length > 0, username: null });
        return;
      }

      // Decode the access_token JWT and require a present, non-expired token.
      const atCookie = cookies.find(c => c.name === 'access_token');
      let isLoggedIn = false;
      let username: string | null = null;

      if (atCookie?.value) {
        try {
          const parts = atCookie.value.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const notExpired = !payload.exp || payload.exp * 1000 > Date.now();
            isLoggedIn = notExpired;
            if (notExpired) {
              username = payload.username || payload.displayName || payload.name || payload.email || payload.sub || null;
            }
          }
        } catch { /* malformed token → treat as logged out */ }
      }

      // Username enrichment from the identity cookie (only when actually logged in).
      if (isLoggedIn && !username) {
        const identityCookie = cookies.find(c => c.name.includes('identity'));
        if (identityCookie) {
          try {
            const decoded = JSON.parse(atob(identityCookie.value));
            username = decoded.email || decoded.username || decoded.displayName || null;
          } catch { /* ignore */ }
        }
      }

      sendResponse({ isLoggedIn, username });
    });
    return true;
  }

  // Popup handshake button
  if (message.type === 'INIT_HANDSHAKE') {
    initiateHandshake().then(sendResponse);
    return true;
  }

  // Retry handshake from dashboard
  if (message.type === 'ANZEIGENBOOST_RETRY_HANDSHAKE') {
    initiateHandshake().then(sendResponse);
    return true;
  }

  // Instant repost ("Jetzt") — full flow with delete + create, runs client-side
  // in the user's own browser tab, visible, using their session and IP.
  if (message.type === 'AB_REPOST_INSTANT') {
    const adId = (String(message.adId || '').match(/\d{5,}/) || [''])[0];
    if (!adId) { sendResponse({ ok: false, error: 'no valid numeric adId' }); return true; }

    // Fetch ad data from backend, then run via the shared single-runner path.
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ ok: false, error: 'no session token' }); return; }
      let adData: any = null;
      try {
        const adsRes = await fetch(`${API_URL}/ads`, { headers: { Authorization: `Bearer ${token}` } });
        if (adsRes.ok) {
          const adsResponse = await adsRes.json();
          const ads = adsResponse.ads || adsResponse.data || [];
          adData = ads.find((a: any) => String(a.id) === adId);
          if (!adData) console.warn('[BG] ad not found in list:', adId);
        } else {
          console.warn('[BG] failed to fetch ads:', adsRes.status);
        }
      } catch (err: any) {
        console.warn('[BG] failed to fetch ad data:', err.message);
      }

      const isSmart = adData?.repostMode === 'smart';

      // Credits: reserve before running the repost. Insufficient balance
      // blocks it outright and reports back so the dashboard toast can show
      // "Credits aufladen" instead of a generic failure.
      const creditActionId = crypto.randomUUID();
      const reservation = await reserveCredits(token, isSmart ? 'smart_repost' : 'repost', creditActionId);
      if (!reservation.ok) {
        sendResponse({ ok: false, error: reservation.error });
        return;
      }

      const result = await performRepost(adId, adData);
      confirmCredits(token, creditActionId, result.ok);

      // Carry the recurring auto-repost schedule forward onto the newly
      // created ad. The instant "Jetzt" repost deletes the old Kleinanzeigen
      // ad and creates a new one under a different id — without this, the
      // schedule stays attached to a Firestore doc for an ad that no longer
      // exists, and the next sync creates a fresh doc for the new ad with no
      // schedule at all, silently dropping Smart Repost / auto-repost.
      if (result.ok && adData?.autoRepost && result.finalUrl) {
        const newAdId = (String(result.finalUrl).match(/[?&]adId=(\d+)/) || [])[1];
        if (newAdId && newAdId !== adId) {
          try {
            const nextRepostAt = isSmart
              ? computeNextSmartRepost(Date.now())
              : new Date(Date.now() + (Number(adData.repostIntervalMinutes) || 1440) * 60000).toISOString();
            const patch: any = {
              autoRepost: true,
              status: 'active',
              repostMode: adData.repostMode,
              smartVariation: adData.smartVariation,
              nextRepostAt,
              trackedRepostsCount: (Number(adData.trackedRepostsCount) || 0) + 1,
            };
            if (adData.repostIntervalMinutes) patch.repostIntervalMinutes = adData.repostIntervalMinutes;
            await fetch(`${API_URL}/ads/${newAdId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(patch),
            });
            console.log(`[BG] carried auto-repost schedule forward: ${adId} → ${newAdId}`);
          } catch (e: any) {
            console.warn('[BG] failed to carry schedule to new ad id:', e.message);
          }
        }
      }

      sendResponse(result);
    });
    return true;
  }

  // Popup credits balance display. Backend returns {enabled:false} when
  // ENABLE_CREDITS is off — the popup uses that to decide whether to render
  // the balance UI at all, so no separate flag-fetch is needed here.
  if (message.type === 'GET_CREDITS_BALANCE') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ ok: false, error: 'no session token' }); return; }
      try {
        const res = await fetch(`${API_URL}/credits/balance`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        sendResponse({ ok: res.ok, enabled: data.enabled, balance: data.balance });
      } catch (e: any) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }

  // Popup "Credits aufladen" button — creates a Stripe Checkout session and
  // returns its hosted URL for the popup to open via chrome.tabs.create.
  if (message.type === 'CREATE_CREDITS_CHECKOUT') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ ok: false, error: 'no session token' }); return; }
      try {
        const res = await fetch(`${API_URL}/credits/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ packId: message.packId }),
        });
        const data = await res.json();
        sendResponse({ ok: res.ok, url: data.url, error: data.message });
      } catch (e: any) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }

  // Diagnostic: fire an immediate test notification AND run the scheduler check
  // verbosely. If the test notification doesn't appear → OS notifications are off.
  if (message.type === 'AB_SIM_TEST') {
    alertOnKaTab('🔔 AnzeigenBoost Test-Alert — der Cron-Mechanismus funktioniert!');
    chrome.notifications.create('ab-sim-test-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: '🔔 AnzeigenBoost Test',
      message: 'Wenn du das siehst, funktionieren Benachrichtigungen. Prüfe jetzt die Konsole für [BG][sim].',
    });
    runSimulatedScheduler(true).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // Logout
  if (message.type === 'LOGOUT') {
    chrome.storage.session.remove(['token'], () => {
      if (chrome.runtime.lastError) {
        console.warn('[BG] storage.session.remove error:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ success: true });
    });
    return true;
  }
});
