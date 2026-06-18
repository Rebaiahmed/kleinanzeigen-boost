/**
 * Dashboard content script.
 * Injected into the AnzeigenBoost web app (localhost:5173 / app.anzeigenboost.de).
 */

function isExtensionAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function sendToBackground(message: any, callback?: (response: any) => void) {
  if (!isExtensionAlive()) {
    window.postMessage({ type: 'EXTENSION_CONTEXT_INVALIDATED' }, '*');
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[AnzeigenBoost] sendMessage error:', chrome.runtime.lastError.message);
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          window.postMessage({ type: 'EXTENSION_CONTEXT_INVALIDATED' }, '*');
        }
        callback?.(null);
      } else {
        callback?.(response);
      }
    });
  } catch (e: any) {
    console.warn('[AnzeigenBoost] sendMessage threw:', e.message);
    window.postMessage({ type: 'EXTENSION_CONTEXT_INVALIDATED' }, '*');
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'ANZEIGENBOOST_SET_TOKEN') {
    if (data.token) {
      sendToBackground({ type: 'STORE_SESSION_TOKEN', token: data.token }, (response) => {
        if (response) console.log('[AnzeigenBoost] Token relayed to background:', response);
      });
    }
    return;
  }

  if (data.type === 'TRIGGER_SYNC_REQUEST') {
    sendToBackground({ type: 'TRIGGER_SYNC' }, (response) => {
      window.postMessage({
        type: 'TRIGGER_SYNC_RESPONSE',
        success: !!response?.success,
        ads: response?.ads || [],
        error: response?.error || (!response ? 'Extension context invalidated — please reload the page.' : undefined),
      }, '*');
    });
    return;
  }

  if (data.type === 'ANZEIGENBOOST_INIT_HANDSHAKE' || data.type === 'ANZEIGENBOOST_RETRY_HANDSHAKE') {
    sendToBackground({ type: 'ANZEIGENBOOST_RETRY_HANDSHAKE' }, (response) => {
      if (response) console.log('[AnzeigenBoost] Retry handshake relayed:', response);
    });
    return;
  }

  if (data.type === 'CHECK_PLATFORM_LOGIN') {
    sendToBackground({ type: 'CHECK_PLATFORM_LOGIN', platform: data.platform }, (response) => {
      if (response) {
        window.postMessage({
          type: 'PLATFORM_LOGIN_STATUS',
          platform: data.platform,
          isLoggedIn: response.isLoggedIn,
          username: response.username || null,
        }, '*');
      }
    });
    return;
  }

  // Instant repost ("Jetzt") — relay to background engine
  if (data.type === 'AB_REPOST_INSTANT' && data.adId) {
    console.log('[AnzeigenBoost] Relaying AB_REPOST_INSTANT for ad:', data.adId);
    sendToBackground({ type: 'AB_REPOST_INSTANT', adId: data.adId }, (response) => {
      console.log('[AnzeigenBoost] Repost response:', response);
      window.postMessage({
        type: 'AB_REPOST_INSTANT_RESPONSE',
        ...response
      }, '*');
    });
    return;
  }
});

function announceReady() {
  if (!isExtensionAlive()) return;
  try {
    window.postMessage({
      type: 'ANZEIGENBOOST_EXTENSION_READY',
      extensionId: chrome.runtime.id,
    }, '*');
  } catch { /* context already gone */ }
}

announceReady();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announceReady);
} else {
  setTimeout(announceReady, 500);
}

console.log('[AnzeigenBoost] Dashboard content script loaded.');
