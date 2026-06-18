/**
 * Client-side repost — KA content script.
 *
 * MILESTONE 1 (validation only): prove that a content script can fill the post
 * form AND attach a photo to KA's <input type="file">. Uses a canvas-generated
 * test image (no network/CORS). Non-destructive — fills the "Anzeige aufgeben"
 * form but does NOT submit and does NOT delete anything.
 *
 * Trigger it from the KA post-form page console:
 *   window.postMessage({ type: 'AB_REPOST_TEST' }, '*')
 *
 * See docs/REPOST-CLIENT-SIDE.md.
 */

function log(...args: any[]) {
  console.log('[AB-repost]', ...args);
}

/** Set a React-controlled input/textarea's value so the framework registers it. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Attach a test image by asking the background to inject into the page's MAIN
 * world via chrome.scripting (world:'MAIN'). This bypasses KA's CSP, which
 * blocks a content-script <script> injection. The injected code builds the File
 * in the page realm (required — isolated-world File objects are rejected) and
 * tries both input.files and a synthetic drop.
 */
function attachTestPhotoMainWorld() {
  try {
    chrome.runtime.sendMessage({ type: 'AB_INJECT_PHOTO_TEST' }, (resp) => {
      // Manifest V3: must check lastError to avoid "Unchecked runtime.lastError" warnings
      if (chrome.runtime.lastError) {
        log('inject failed:', chrome.runtime.lastError.message);
        return;
      }
      if (!resp?.ok) log('inject reported failure:', resp?.error);
    });
  } catch (e: any) {
    log('inject threw:', e.message);
  }
}

async function runTestFill() {
  log('▶ Milestone-1 test fill starting (non-destructive, will NOT submit)');

  const title = document.querySelector<HTMLInputElement>('#ad-title');
  const price = document.querySelector<HTMLInputElement>('#ad-price-amount');
  const desc = document.querySelector<HTMLTextAreaElement>('#ad-description');
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]');

  if (!title || !price || !desc) {
    log('✗ Not on the post form (missing #ad-title/#ad-price-amount/#ad-description). Open p-anzeige-aufgeben-schritt2.html first.');
    return;
  }

  setNativeValue(title, 'AnzeigenBoost Test – bitte nicht veröffentlichen');
  setNativeValue(price, '42');
  setNativeValue(desc, 'Testbeschreibung von AnzeigenBoost (Milestone 1). Nicht absenden.');
  log('✓ filled title / price / description');

  if (!fileInput) {
    log('✗ No file input found — photo-upload technique cannot be tested here.');
    return;
  }
  log('attaching test photo via CDP (chrome.debugger → DOM.setFileInputFiles)…');
  attachTestPhotoMainWorld();   // legacy attempt (kept for comparison; fails on KA)
  try {
    chrome.runtime.sendMessage({ type: 'AB_CDP_UPLOAD_TEST' }, (resp) => {
      // Manifest V3: must check lastError to avoid "Unchecked runtime.lastError" warnings
      if (chrome.runtime.lastError) {
        log('CDP test failed:', chrome.runtime.lastError.message);
        return;
      }
      log('CDP test result:', JSON.stringify(resp));
    });
  } catch (e: any) {
    log('CDP test threw:', e.message);
  }
  log('■ fill done, CDP upload dispatched. Nothing submitted. WATCH the form + look for [AB-cdp] logs.');
}

/** Inject repost button — DISABLED for now (styling issues) */
function injectRepostButtons() {
  // TODO: Re-enable when styling is properly matched to Kleinanzeigen native buttons
  return;
}

export function initKaRepost() {
  // Background → content alert (used by the simulated scheduler so the signal
  // doesn't depend on OS notification permissions).
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'AB_SIM_ALERT') alert(msg.text || 'AnzeigenBoost');
    });
  } catch { /* no chrome.runtime in some contexts */ }

  // Inject test buttons on the manage page + keep them as the SPA re-renders.
  injectRepostButtons();
  const obs = new MutationObserver(() => injectRepostButtons());
  obs.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const t = event.data?.type;
    if (t === 'AB_REPOST_TEST') runTestFill();
    // Diagnostic for the simulated scheduler.
    if (t === 'AB_SIM_TEST') {
      log('firing scheduler diagnostic → check service-worker console for [BG][sim]');
      try {
        chrome.runtime.sendMessage({ type: 'AB_SIM_TEST' }, (r) => {
          // Manifest V3: must check lastError to avoid "Unchecked runtime.lastError" warnings
          if (chrome.runtime.lastError) {
            log('sim test error:', chrome.runtime.lastError.message);
            return;
          }
          log('sim test result:', JSON.stringify(r));
        });
      } catch (e: any) {
        log('sim test threw:', e.message);
      }
    }
    // v1 real repost (CREATE-ONLY, no delete) — forwards to the background engine.
    if (t === 'AB_REPOST_CREATE' && event.data?.adId) {
      log('forwarding AB_REPOST_CREATE for ad', event.data.adId, '→ background engine (watch the service-worker console for [AB-engine] logs)');
      try {
        chrome.runtime.sendMessage({ type: 'AB_REPOST_CREATE_TEST', adId: String(event.data.adId) }, (resp) => {
          // Manifest V3: must check lastError to avoid "Unchecked runtime.lastError" warnings
          if (chrome.runtime.lastError) {
            log('engine error:', chrome.runtime.lastError.message);
            return;
          }
          log('engine result:', JSON.stringify(resp));
        });
      } catch (e: any) {
        log('forward threw:', e.message);
      }
    }

    // Instant repost ("Jetzt") — delete + create, runs client-side via CDP engine.
    if (t === 'AB_REPOST_INSTANT' && event.data?.adId) {
      log('forwarding AB_REPOST_INSTANT for ad', event.data.adId, '→ background engine (watch the service-worker console for [AB-engine] logs)');
      try {
        chrome.runtime.sendMessage({ type: 'AB_REPOST_INSTANT', adId: String(event.data.adId) }, (resp) => {
          // Manifest V3: must check lastError to avoid "Unchecked runtime.lastError" warnings
          if (chrome.runtime.lastError) {
            log('engine error:', chrome.runtime.lastError.message);
            window.postMessage({ type: 'AB_REPOST_INSTANT_RESPONSE', ok: false, error: chrome.runtime.lastError.message }, '*');
            return;
          }
          // Relay the result back to the webpage so the frontend can show feedback
          window.postMessage({ type: 'AB_REPOST_INSTANT_RESPONSE', ...resp }, '*');
          log('engine result:', JSON.stringify(resp));
        });
      } catch (e: any) {
        log('forward threw:', e.message);
        window.postMessage({ type: 'AB_REPOST_INSTANT_RESPONSE', ok: false, error: e.message }, '*');
      }
    }
  });
  log('content ready. Real repost test (create-only): window.postMessage({type:"AB_REPOST_CREATE", adId:"<AD_ID>"},"*")');
}
