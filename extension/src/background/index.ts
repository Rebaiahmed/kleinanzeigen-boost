// Background service worker — MV3 compatible, no persistent WebSocket
// Sync is extension-initiated: frontend triggers TRIGGER_SYNC → background
// fetches ads from Kleinanzeigen → POSTs to backend.
import { ENDPOINTS } from '../config/endpoints';

const API_URL = ENDPOINTS.API_BASE;

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
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'periodic-sync') return;
  chrome.storage.session.get(['token'], async ({ token }: any) => {
    if (!token) return;
    try { await doSync(token); console.log('[BG] Periodic sync done'); }
    catch (e: any) { console.warn('[BG] Periodic sync failed:', e.message); }
  });
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
      sendResponse({ success: true });
    });
    return true;
  }

  // Check if user is logged into a platform via cookies
  if (message.type === 'CHECK_PLATFORM_LOGIN') {
    const domains: Record<string, string> = {
      kleinanzeigen: 'kleinanzeigen.de',
      vinted: 'vinted.de',
      ebay: 'ebay.de',
    };
    const domain = domains[message.platform] || '';
    chrome.cookies.getAll({ domain }, (cookies) => {
      let username: string | null = null;
      if (message.platform === 'kleinanzeigen') {
        // Try to decode the 'up' cookie (base64 JSON user profile)
        const upCookie = cookies.find(c => c.name === 'up');
        if (upCookie) {
          try {
            const decoded = JSON.parse(decodeURIComponent(upCookie.value));
            username = decoded.username || decoded.displayName || decoded.name || decoded.nickName || null;
            console.log('[BG] up cookie keys:', Object.keys(decoded).join(', '), '| username:', username);
          } catch {
            try {
              const decoded = JSON.parse(atob(upCookie.value));
              username = decoded.username || decoded.displayName || decoded.name || null;
            } catch { /* not decodable */ }
          }
        }
        // Fallback: named username cookies
        if (!username) {
          const nameCookie = cookies.find(c => ['user.username', 'username', 'ka_username'].includes(c.name));
          if (nameCookie) username = decodeURIComponent(nameCookie.value);
        }
      }
      sendResponse({ isLoggedIn: cookies.length > 0, username });
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

  // Logout
  if (message.type === 'LOGOUT') {
    chrome.storage.session.remove(['token'], () => sendResponse({ success: true }));
    return true;
  }
});
