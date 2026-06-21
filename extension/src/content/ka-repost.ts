/**
 * Kleinanzeigen content script — minimal.
 *
 * The real repost runs from the background service worker (see
 * src/background/repost-engine.ts) in a tab it opens itself, and the dashboard
 * relays triggers via src/content/dashboard.ts. This file only surfaces the
 * scheduler's in-page alert on Kleinanzeigen tabs (so the signal doesn't depend
 * on OS notification permissions).
 */
export function initKaRepost() {
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'AB_SIM_ALERT') alert(msg.text || 'AnzeigenBoost');
    });
  } catch { /* no chrome.runtime in some contexts */ }
}
