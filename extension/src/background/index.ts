// Background service worker — MV3 compatible, no persistent WebSocket
// Sync is extension-initiated: frontend triggers TRIGGER_SYNC → background
// fetches ads from Kleinanzeigen → POSTs to backend.
import { ENDPOINTS } from '../config/endpoints';
import { executeRepostCreateOnly, executeRepostFullFlow } from './repost-engine';

const API_URL = ENDPOINTS.API_BASE;

// ─── Uninstall feedback form ──────────────────────────────────────────────────
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScNP_PSe3pRAKCwS8vIMd2GVB_trsRKwi3XTb8CRSmqUwprkA/viewform';

function registerUninstallUrl() {
  chrome.runtime.setUninstallURL(FEEDBACK_FORM_URL, () => {
    if (chrome.runtime.lastError) {
      console.warn('[BG] Failed to set uninstall URL:', chrome.runtime.lastError.message);
    } else {
      console.log('[BG] Uninstall feedback form registered');
    }
  });
}

// Register on extension startup (survives MV3 service worker restarts)
registerUninstallUrl();

// Also register on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[BG] Extension installed, registering uninstall URL');
    registerUninstallUrl();
  }
});

// ─── Periodic sync via alarms (wake-safe) ────────────────────────────────────

async function doSync(token: string): Promise<{ success: boolean; ads?: any[]; error?: string }> {
  const res = await fetch(ENDPOINTS.MARKETPLACE_ADS_JSON, { credentials: 'include' });
  if (!res.ok) throw new Error(`Kleinanzeigen returned ${res.status}`);
  const raw = await res.json();
  const ads = Array.isArray(raw.ads) ? raw.ads
    : Array.isArray(raw.listings) ? raw.listings
    : Array.isArray(raw) ? raw : [];
  if (ads.length > 0) console.log('[BG] Ad sample keys:', Object.keys(ads[0]));
  const importRes = await fetch(`${API_URL}/ads/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ads }),
  });
  const data = await importRes.json();
  if (!importRes.ok) throw new Error(data.message || `Import failed ${importRes.status}`);

  return { success: true, ads: data.ads || [] };
}

chrome.alarms.create('periodic-sync', { periodInMinutes: 30 });

// NOTE: extension-side simulated scheduler is DISABLED — the simulation now runs
// in the BACKEND cron (REPOST_SIMULATE=true) and the dashboard shows the notifs.
// The alarm below is intentionally not created (kept the code for reference).
// chrome.alarms.create('repost-sim-check', { periodInMinutes: 1 });

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
  if (verbose) {
    console.log(`[BG][sim] fetched ${ads.length} ad(s). Auto-repost ads:`);
    ads.filter((a) => a.autoRepost).forEach((a) =>
      console.log(`[BG][sim]   ad ${a.id}: nextRepostAt=${a.nextRepostAt} (due=${a.nextRepostAt ? new Date(a.nextRepostAt).getTime() <= now : false}) listingState=${a.listingState}`));
  }
  const due = ads.filter((a) =>
    a.autoRepost === true &&
    a.nextRepostAt && new Date(a.nextRepostAt).getTime() <= now &&
    (!a.listingState || a.listingState === 'active'),
  );
  if (verbose) console.log(`[BG][sim] due now: ${due.length}`);
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
    console.log(`[BG][sim] notified + rescheduled ad ${ad.id} → next ${next}`);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodic-sync') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) return;
      try { await doSync(token); console.log('[BG] Periodic sync done'); }
      catch (e: any) { console.warn('[BG] Periodic sync failed:', e.message); }
    });
  } else if (alarm.name === 'repost-sim-check') {
    runSimulatedScheduler().catch((e) => console.warn('[BG][sim] failed:', e.message));
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
        console.log('[BG] Sending token from session storage');
        sendResponse({ token });
      } else {
        // Fallback: try to get from local storage (for development)
        chrome.storage.local.get(['token'], ({ token: localToken }: any) => {
          if (chrome.runtime.lastError) {
            console.warn('[BG] storage.local.get error:', chrome.runtime.lastError.message);
            sendResponse({ token: null });
            return;
          }
          console.log('[BG] Sending token from local storage:', localToken ? 'found' : 'not found');
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

      console.log('[BG] KA login check → isLoggedIn:', isLoggedIn, '| username:', username);
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

  // Inject the photo-attach test into the page's MAIN world (bypasses KA's CSP,
  // which blocks content-script <script> injection). Validates the upload trick.
  if (message.type === 'AB_INJECT_PHOTO_TEST') {
    const tabId = _sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return true; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        // Diagnostic: list every file input on the page so we know our target.
        const allInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
        console.log('[AB-main] file inputs on page:', allInputs.length);
        allInputs.forEach((el, i) => console.log(`[AB-main]   input#${i}: accept="${el.accept}" multiple=${el.multiple} disabled=${el.disabled} hidden=${el.offsetParent === null} class="${el.className}"`));

        const input = (allInputs.find((el) => /image/.test(el.accept)) || allInputs[0]) as HTMLInputElement | undefined;
        if (!input) { console.log('[AB-main] ✗ no file input found'); return; }
        const canvas = document.createElement('canvas');
        canvas.width = 600; canvas.height = 400;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#A8C300'; ctx.fillRect(0, 0, 600, 400);
        ctx.fillStyle = '#1f2937'; ctx.font = 'bold 36px sans-serif';
        ctx.fillText('AnzeigenBoost Test', 80, 210);
        canvas.toBlob((blob) => {
          if (!blob) { console.log('[AB-main] ✗ toBlob failed'); return; }
          const file = new File([blob], 'ab-test-' + Date.now() + '.jpg', { type: 'image/jpeg' });
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            console.log('[AB-main] DataTransfer before assign → files.length =', dt.files.length, '(expect 1)');
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[AB-main] input.files after assign → length =', input.files.length);
          } catch (e) { console.log('[AB-main] input.files threw:', (e as Error).message); }
          try {
            const zone = (input.closest('div') || input.parentElement) as HTMLElement;
            const dt2 = new DataTransfer();
            dt2.items.add(file);
            zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt2 }));
            zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt2 }));
            zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt2 }));
            console.log('[AB-main] dispatched synthetic drop; drop dataTransfer.files =', dt2.files.length);
          } catch (e) { console.log('[AB-main] drop threw:', (e as Error).message); }
          console.log('[AB-main] ■ done — WATCH the form for a photo preview');
        }, 'image/jpeg', 0.9);
      },
    }).then(() => sendResponse({ ok: true })).catch((e) => {
      console.warn('[BG] executeScript failed:', e.message);
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // CDP UPLOAD TEST — attach a photo to KA's file input via chrome.debugger
  // (DOM.setFileInputFiles), the same mechanism Playwright/kleinanzeigen-bot use.
  // This bypasses the file-input security wall that blocks input.files. Runs in
  // the user's own browser (home IP, real session). Non-destructive: does not submit.
  if (message.type === 'AB_CDP_UPLOAD_TEST') {
    const tabId = _sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return true; }
    runCdpUploadTest(tabId).then(sendResponse);
    return true;
  }

  // v1 client-side repost (CREATE-ONLY, no delete) — runs the CDP engine on the
  // active KA tab. Needs an active kleinanzeigen.de tab to attach the debugger to.
  if (message.type === 'AB_REPOST_CREATE_TEST') {
    // Accept either the numeric id or the URL slug (e.g. "3406908146-81-1928").
    const adId = (String(message.adId || '').match(/\d{5,}/) || [''])[0];
    if (!adId) { sendResponse({ ok: false, error: 'no valid numeric adId' }); return true; }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs.find((t) => /kleinanzeigen\.de/.test(t.url || '')) || tabs[0];
      if (!tab?.id) { sendResponse({ ok: false, error: 'no active KA tab — open kleinanzeigen.de first' }); return; }
      executeRepostCreateOnly(tab.id, adId).then((result) => {
        // Surface the outcome as a desktop notification (the tab navigates during
        // the flow, so the page callback often can't deliver it).
        const title = result.ok ? '✅ Repost-Test fertig' : '❌ Repost-Test fehlgeschlagen';
        const msg = result.ok
          ? `Schritt: ${result.step}. Prüfe deine Anzeigen auf ein neues Duplikat.\n${result.finalUrl || ''}`
          : `Bei Schritt "${result.step}": ${result.error}`;
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title,
          message: msg.slice(0, 300),
        });
        sendResponse(result);
      });
    });
    return true;
  }

  // Instant repost ("Jetzt") — full flow with delete + create, runs client-side
  // in the user's own browser tab, visible, using their session and IP.
  if (message.type === 'AB_REPOST_INSTANT') {
    const adId = (String(message.adId || '').match(/\d{5,}/) || [''])[0];
    if (!adId) { sendResponse({ ok: false, error: 'no valid numeric adId' }); return true; }

    // Fetch ad data from backend
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ ok: false, error: 'no session token' }); return; }

      let adData: any = null;
      try {
        // Fetch all ads and find the matching one
        const adsRes = await fetch(`${API_URL}/ads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (adsRes.ok) {
          const adsResponse = await adsRes.json();
          const ads = adsResponse.ads || adsResponse.data || [];
          adData = ads.find((a: any) => String(a.id) === adId);
          if (adData) {
            console.log('[BG] fetched ad data:', { id: adData.id, title: adData.title, images: adData.images?.length || 0 });
          } else {
            console.warn('[BG] ad not found in list:', adId);
          }
        } else {
          console.warn('[BG] failed to fetch ads:', adsRes.status);
        }
      } catch (err: any) {
        console.warn('[BG] failed to fetch ad data:', err.message);
      }

      // Open a NEW tab to Kleinanzeigen (not reuse dashboard tab)
      chrome.tabs.create({ url: 'https://www.kleinanzeigen.de' }, (newTab) => {
        if (!newTab?.id) {
          sendResponse({ ok: false, error: 'failed to create new tab' });
          return;
        }
        // Wait a moment for the tab to load, then run repost
        setTimeout(() => {
          executeRepostFullFlow(newTab.id!, adId, adData).then((result) => {
            const title = result.ok ? '✅ Anzeige neu eingestellt' : '❌ Neu einstellen fehlgeschlagen';
            const msg = result.ok
              ? `Deine Anzeige wurde erfolgreich neu eingestellt.\n${result.finalUrl || ''}`
              : `Bei Schritt "${result.step}": ${result.error}`;
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon-128.png',
              title,
              message: msg.slice(0, 300),
            });
            sendResponse(result);
          }).catch((e) => {
            console.error('[BG] executeRepostFullFlow error:', e.message);
            sendResponse({ ok: false, error: e.message, step: 'unknown' });
          });
        }, 1000); // Wait 1 second for new tab to initialize
      });
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
    }, (id) => {
      const err = chrome.runtime.lastError;
      console.log('[BG][sim] test notification created id=', id, 'err=', err?.message);
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

// ─── CDP file-upload proof-of-concept ─────────────────────────────────────────

/** Promisified chrome.debugger.sendCommand. */
function cdp(target: chrome.debugger.Debuggee, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params || {}, (res) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message)); else resolve(res);
    });
  });
}

/** Download a tiny test image and return its absolute on-disk path. */
function downloadTestImage(): Promise<string> {
  // 8x8 green PNG (valid image KA will accept for the POC).
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR42mNkYPhfz0BkYBxVSFQFAP9cBQHsx0p6AAAAAElFTkSuQmCC';
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url: dataUrl, filename: 'anzeigenboost/ab-test.png', conflictAction: 'overwrite' }, (id) => {
      if (chrome.runtime.lastError || id == null) { reject(new Error(chrome.runtime.lastError?.message || 'download failed')); return; }
      const onChanged = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id !== id || !delta.state) return;
        if (delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(onChanged);
          chrome.downloads.search({ id }, (items) => {
            const f = items?.[0]?.filename;
            if (f) resolve(f); else reject(new Error('no file path after download'));
          });
        } else if (delta.state.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(onChanged);
          reject(new Error('download interrupted'));
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  });
}

async function runCdpUploadTest(tabId: number): Promise<{ ok: boolean; filesLength?: number; error?: string; filePath?: string; fileBytes?: number }> {
  const target = { tabId };
  let fileBytes = -1;
  try {
    const filePath = await downloadTestImage();
    await new Promise<void>((r) => chrome.downloads.search({}, (items) => {
      const it = items.find((i) => i.filename === filePath);
      fileBytes = it?.fileSize ?? it?.totalBytes ?? -1;
      r();
    }));
    console.log('[AB-cdp] test image downloaded to:', filePath, 'bytes=', fileBytes);

    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(target, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
    console.log('[AB-cdp] debugger attached');

    await cdp(target, 'DOM.enable');
    const { root } = await cdp(target, 'DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp(target, 'DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type="file"][accept*="image"]' });
    if (!nodeId) throw new Error('file input not found via CDP');

    await cdp(target, 'DOM.setFileInputFiles', { files: [filePath], nodeId });
    console.log('[AB-cdp] DOM.setFileInputFiles sent for path:', filePath);

    // Verify how many files the input now holds (via the page).
    const { object } = await cdp(target, 'DOM.resolveNode', { nodeId });
    let filesLength = -1;
    if (object?.objectId) {
      const r = await cdp(target, 'Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: 'function(){ this.dispatchEvent(new Event("change",{bubbles:true})); this.dispatchEvent(new Event("input",{bubbles:true})); return this.files ? this.files.length : -1; }',
        returnByValue: true,
      });
      filesLength = r?.result?.value;
    }
    console.log('[AB-cdp] ✓ input.files.length after CDP upload =', filesLength, '→ WATCH the form for a preview');

    await new Promise<void>((resolve) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          console.warn('[AB-cdp] debugger.detach error:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });
    return { ok: true, filesLength, filePath, fileBytes };
  } catch (e: any) {
    console.warn('[AB-cdp] ✗ failed:', e.message);
    await new Promise<void>((resolve) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          console.warn('[AB-cdp] debugger.detach error during cleanup:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    }).catch(() => {});
    return { ok: false, error: e.message, fileBytes };
  }
}
