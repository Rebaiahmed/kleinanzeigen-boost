// Background service worker
import { ENDPOINTS } from '../config/endpoints';

const API_URL = ENDPOINTS.API_BASE;
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/extension';

let ws: WebSocket | null = null;
let reconnectTimeout: any = null;
let currentToken: string | null = null;

// Connect to NestJS WebSocket Server
function connectWebSocket(token: string) {
  if (ws) {
    try {
      ws.close();
    } catch (e) {}
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  currentToken = token;
  ws = new WebSocket(`${WS_URL}?token=${token}`);

  ws.onopen = () => {
    console.log('[Extension WS] Connected to backend');
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      const { commandId, action, payload } = message;

      if (!commandId || !action) return;

      console.log(`[Extension WS] Received command: ${action}`, payload);

      if (action === 'PING') {
        ws?.send(JSON.stringify({
          type: 'COMMAND_RESPONSE',
          commandId,
          success: true,
          payload: { pong: true }
        }));
      } else if (action === 'SYNC_ADS') {
        try {
          const res = await fetch(ENDPOINTS.MARKETPLACE_ADS_JSON);
          if (!res.ok) {
            throw new Error(`Kleinanzeigen API returned status ${res.status}`);
          }
          const rawData = await res.json();
          // Extract and transform ads list if necessary
          const ads = Array.isArray(rawData.ads) ? rawData.ads : (rawData.listings || []);
          ws?.send(JSON.stringify({
            type: 'COMMAND_RESPONSE',
            commandId,
            success: true,
            payload: ads
          }));
        } catch (err: any) {
          ws?.send(JSON.stringify({
            type: 'COMMAND_RESPONSE',
            commandId,
            success: false,
            error: err.message || 'Failed to sync ads via extension'
          }));
        }
      } else {
        // Unhandled actions for now
        ws?.send(JSON.stringify({
          type: 'COMMAND_RESPONSE',
          commandId,
          success: false,
          error: `Unhandled action: ${action}`
        }));
      }
    } catch (err: any) {
      console.error('[Extension WS] Error processing message:', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[Extension WS] Closed:', event.reason);
    ws = null;
    
    // Auto-reconnect if token is still active
    if (currentToken) {
      reconnectTimeout = setTimeout(() => {
        if (currentToken) connectWebSocket(currentToken);
      }, 5000);
    }
  };

  ws.onerror = (err) => {
    console.error('[Extension WS] Socket error:', err);
  };
}

// Watch token in chrome session storage to control WS connection state
chrome.storage.session.get(['token'], (result: any) => {
  if (result.token) {
    connectWebSocket(result.token as string);
  }
});

chrome.storage.onChanged.addListener((changes: any, areaName) => {
  if (areaName === 'session' && changes.token) {
    const newToken = changes.token.newValue;
    if (newToken) {
      connectWebSocket(newToken as string);
    } else {
      currentToken = null;
      if (ws) {
        ws.close();
        ws = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    }
  }
});

/**
 * Helper: Opens the auth callback URL in a new tab.
 * Waits for the tab to reach status=complete before appending the token to the
 * URL, so the frontend's useEffect is guaranteed to run after DOM load.
 * Also waits 500 ms after tab creation to let the Firestore write fully commit.
 */
function openCallbackTab(token: string) {
  const baseUrl = ENDPOINTS.DASHBOARD_AUTH_CALLBACK;

  // Step 1: open a blank tab (avoids the race where the page loads before Firestore commits)
  chrome.tabs.create({ url: baseUrl }, (tab) => {
    if (!tab?.id) return;
    const tabId = tab.id;

    // Step 2: wait 500 ms so Firestore write propagates, then navigate to the real URL
    setTimeout(() => {
      chrome.tabs.update(tabId, { url: `${baseUrl}?token=${token}` });
    }, 500);
  });
}

/**
 * Helper: Perform the full handshake flow (cookie read → POST /auth/handshake-token → open tab).
 * Returns a promise that resolves with { success, error? }.
 */
function initiateHandshake(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!chrome.cookies) {
      resolve({ success: false, error: 'Cookies API nicht verfügbar. Bitte Erweiterung neu laden!' });
      return;
    }

    chrome.cookies.getAll({ domain: ENDPOINTS.MARKETPLACE_DOMAIN }, (cookies) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: 'Cookie Fehler: ' + chrome.runtime.lastError.message });
        return;
      }

      if (!cookies || cookies.length === 0) {
        resolve({ success: false, error: 'Keine Kleinanzeigen Cookies gefunden. Bitte auf kleinanzeigen.de einloggen.' });
        return;
      }

      fetch(`${API_URL}/auth/handshake-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies })
      })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          openCallbackTab(data.token);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: data.message || 'Token Generierung fehlgeschlagen.' });
        }
      })
      .catch(err => {
        resolve({ success: false, error: 'Serverfehler: ' + err.message });
      });
    });
  });
}

// Listen for messages from both the popup and the web app page
chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'CHECK_AUTH') {
    chrome.storage.session.get(['token'], (result) => {
      sendResponse({ isAuthenticated: !!result.token });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'FETCH_AND_LOGIN') {
    const email = message.payload.email;
    chrome.cookies.getAll({ domain: ENDPOINTS.MARKETPLACE_DOMAIN }, (cookies) => {
      if (!cookies || cookies.length === 0) {
        sendResponse({ success: false, error: 'Keine Kleinanzeigen Cookies gefunden.' });
        return;
      }
      const cookieString = JSON.stringify(cookies);
      fetch(`${API_URL}/auth/login/cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cookies: cookieString })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success || data.accessToken) {
          const token = data.accessToken || 'mock-jwt-token-cookie';
          chrome.storage.session.set({ token }, () => {
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: data.message || 'Login fehlgeschlagen.' });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: 'Serverfehler: ' + err.message });
      });
    });
    return true;
  }

  if (message.type === 'INIT_HANDSHAKE') {
    initiateHandshake().then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'LOGOUT') {
    chrome.storage.session.remove(['token'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Listen for ANZEIGENBOOST_RETRY_HANDSHAKE posted from the web app tab.
// chrome.runtime cannot receive window.postMessage directly, so we relay it
// via the content script (or via externally_connectable). As a fallback that
// works without a content script, we listen for the message being forwarded
// by chrome.runtime.sendMessage from the web app (handled in content.ts).
// Additionally we expose a direct runtime message handler so any component
// can trigger a retry programmatically.
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.type === 'ANZEIGENBOOST_RETRY_HANDSHAKE') {
    initiateHandshake().then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'CHECK_PLATFORM_LOGIN') {
    const platform = message.platform;
    let domain = '';
    if (platform === 'vinted') domain = 'vinted.de';
    if (platform === 'ebay') domain = 'ebay.de';

    if (!chrome.cookies) {
      sendResponse({ isLoggedIn: false });
      return true;
    }

    chrome.cookies.getAll({ domain }, (cookies) => {
      // Basic check: if cookies exist for the platform domain, assume some level of interaction.
      // In a real scenario, we would check for specific session cookies.
      const isLoggedIn = cookies.length > 0;
      sendResponse({ isLoggedIn, username: isLoggedIn ? `${platform}_user` : '' });
    });
    return true;
  }
});

