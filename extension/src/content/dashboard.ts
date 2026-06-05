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

  if (data.type === 'ANZEIGENBOOST_RETRY_HANDSHAKE') {
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
          username: response?.username
        }, '*');
      }
    });
  }
});

console.log('[AnzeigenBoost] Dashboard content script loaded.');
