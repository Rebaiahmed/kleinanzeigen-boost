/**
 * Dashboard content script.
 * Injected into the AnzeigenBoost web app (localhost:5173 / app.anzeigenboost.de).
 *
 * Bridges window.postMessage({ type: 'ANZEIGENBOOST_RETRY_HANDSHAKE' }) from the
 * React app over to chrome.runtime.sendMessage so the background service worker
 * can re-initiate the Kleinanzeigen handshake flow without user interaction.
 */
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'ANZEIGENBOOST_SET_TOKEN') {
    if (data.token) {
      // Relay to background — content scripts cannot call chrome.storage.session directly
      chrome.runtime.sendMessage({ type: 'STORE_SESSION_TOKEN', token: data.token }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[AnzeigenBoost] Token relay error:', chrome.runtime.lastError.message);
        } else {
          console.log('[AnzeigenBoost] Token relayed to background:', response);
        }
      });
    }
    return;
  }

  if (data.type === 'TRIGGER_SYNC_REQUEST') {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' }, (response) => {
      const error = chrome.runtime.lastError?.message;
      window.postMessage({
        type: 'TRIGGER_SYNC_RESPONSE',
        success: !error && response?.success,
        ads: response?.ads || [],
        error: error || response?.error,
      }, '*');
    });
    return;
  }

  if (data.type === 'ANZEIGENBOOST_INIT_HANDSHAKE' || data.type === 'ANZEIGENBOOST_RETRY_HANDSHAKE') {
    chrome.runtime.sendMessage({ type: 'ANZEIGENBOOST_RETRY_HANDSHAKE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[AnzeigenBoost] Retry handshake relay error:', chrome.runtime.lastError.message);
      } else {
        console.log('[AnzeigenBoost] Retry handshake relayed:', response);
      }
    });
  }

  if (data.type === 'CHECK_PLATFORM_LOGIN') {
    chrome.runtime.sendMessage({ type: 'CHECK_PLATFORM_LOGIN', platform: data.platform }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[AnzeigenBoost] Check platform relay error:', chrome.runtime.lastError.message);
      } else {
        window.postMessage({
          type: 'PLATFORM_LOGIN_STATUS',
          platform: data.platform,
          isLoggedIn: response?.isLoggedIn,
          username: response?.username || null,
        }, '*');
      }
    });
  }
});

function announceReady() {
  window.postMessage({
    type: 'ANZEIGENBOOST_EXTENSION_READY',
    extensionId: chrome.runtime.id,
  }, '*');
}

// Announce immediately (catches pages that load before React mounts)
announceReady();
// Announce again after DOM is ready (ensures React's useEffect listener catches it)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announceReady);
} else {
  setTimeout(announceReady, 500);
}

console.log('[AnzeigenBoost] Dashboard content script loaded.');
