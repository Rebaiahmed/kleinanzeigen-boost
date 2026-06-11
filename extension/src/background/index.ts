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
        // 1. Try zpstorage identity cookie (contains {"email":"..."})
        const identityCookie = cookies.find(c => c.name.includes('identity'));
        if (identityCookie) {
          try {
            const decoded = JSON.parse(atob(identityCookie.value));
            username = decoded.email || decoded.username || decoded.displayName || null;
            console.log('[BG] identity cookie decoded:', decoded, '| username:', username);
          } catch { /* not decodable */ }
        }

        // 2. Try Kleinanzeigen access_token JWT payload
        if (!username) {
          const atCookie = cookies.find(c => c.name === 'access_token');
          if (atCookie) {
            try {
              const parts = atCookie.value.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                username = payload.username || payload.displayName || payload.name || payload.email || payload.sub || null;
                console.log('[BG] access_token payload:', payload, '| username:', username);
              }
            } catch { /* not decodable */ }
          }
        }

        // 3. Fallback: named username cookies
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

  // Fetch the user's reply templates (used by the KA in-page injector).
  // Token stays in the background; content scripts never see it.
  if (message.type === 'FETCH_REPLY_TEMPLATES') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) {
        sendResponse({ success: false, error: 'NOT_CONNECTED' });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/reply-templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          sendResponse({ success: false, error: res.status === 401 ? 'NOT_CONNECTED' : `HTTP ${res.status}` });
          return;
        }
        const templates = await res.json();
        sendResponse({ success: true, templates: Array.isArray(templates) ? templates : [] });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Track that a template was used in a real chat (reuses copy-count endpoint).
  if (message.type === 'TRACK_TEMPLATE_USE') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token || !message.id) { sendResponse({ success: false }); return; }
      try {
        await fetch(`${API_URL}/reply-templates/${message.id}/copy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        sendResponse({ success: true });
      } catch {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  // Repost an ad (server-side delete-and-relist) — from the Meine Anzeigen page.
  if (message.type === 'REPOST_AD') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ success: false, error: 'NOT_CONNECTED' }); return; }
      if (!message.adId) { sendResponse({ success: false, error: 'NO_AD_ID' }); return; }
      try {
        const res = await fetch(`${API_URL}/ads/repost/${encodeURIComponent(message.adId)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { sendResponse({ success: false, error: 'NOT_CONNECTED' }); return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { sendResponse({ success: false, error: data.message || `HTTP ${res.status}` }); return; }
        sendResponse({ success: true, data });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Generate 3 AI title/description variants for an ad.
  if (message.type === 'REWRITE_AD') {
    chrome.storage.session.get(['token'], async ({ token }: any) => {
      if (!token) { sendResponse({ error: 'NOT_CONNECTED' }); return; }
      try {
        const res = await fetch(`${API_URL}/ai/rewrite-variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: message.title, description: message.description }),
        });
        if (res.status === 401) { sendResponse({ error: 'NOT_CONNECTED' }); return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { sendResponse({ error: data.message || `HTTP ${res.status}` }); return; }
        sendResponse({ variants: data.variants || [] });
      } catch (err: any) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  // Logout
  if (message.type === 'LOGOUT') {
    chrome.storage.session.remove(['token'], () => sendResponse({ success: true }));
    return true;
  }
});
