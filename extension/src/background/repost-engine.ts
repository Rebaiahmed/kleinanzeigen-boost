/**
 * Client-side repost engine — drives Kleinanzeigen via CDP (chrome.debugger)
 * from the background worker, so it survives page navigations (content scripts
 * don't). Runs in the user's own browser: real session, home IP, and photo
 * upload works via DOM.setFileInputFiles (page JS can't).
 *
 * v1 = CREATE half only (capture an ad → create a DUPLICATE with its photos).
 * NO delete yet — proves create+photos on a real ad without destroying it.
 * Heavy logging: open the service-worker console to watch ([AB-engine] lines).
 */

type Target = chrome.debugger.Debuggee;

function log(...a: any[]) { console.log('[AB-engine]', ...a); }

function cdp(target: Target, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params || {}, (res) => {
      const e = chrome.runtime.lastError;
      if (e) reject(new Error(`${method}: ${e.message}`)); else resolve(res);
    });
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Evaluate JS in the page (main world, CSP-free) and return the value. */
async function evaluate(target: Target, expression: string): Promise<any> {
  const r = await cdp(target, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

async function navigate(target: Target, url: string): Promise<void> {
  await cdp(target, 'Page.navigate', { url });
  // Wait for document ready, then a beat for React hydration.
  for (let i = 0; i < 40; i++) {
    await delay(300);
    try { if ((await evaluate(target, 'document.readyState')) === 'complete') break; } catch { /* navigating */ }
  }
  await delay(1500);
}

/** Set a value on a React-controlled input/textarea via the native setter. */
function fillExpr(selector: string, value: string): string {
  const v = JSON.stringify(value);
  const s = JSON.stringify(selector);
  return `(() => {
    const el = document.querySelector(${s});
    if (!el) return 'NO_EL';
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${v});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return 'OK';
  })()`;
}

/** Click the first <button>/<a> whose text contains `text`. */
function clickByTextExpr(text: string): string {
  const t = JSON.stringify(text);
  return `(() => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    const el = els.find(e => (e.textContent || '').trim().includes(${t}) && e.offsetParent !== null);
    if (!el) return 'NOT_FOUND';
    el.click();
    return 'CLICKED';
  })()`;
}

async function setFileInput(target: Target, selector: string, paths: string[]): Promise<number> {
  const { root } = await cdp(target, 'DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp(target, 'DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error('file input not found: ' + selector);
  await cdp(target, 'DOM.setFileInputFiles', { files: paths, nodeId });
  return evaluate(target, `(()=>{const e=document.querySelector(${JSON.stringify(selector)}); e&&e.dispatchEvent(new Event('change',{bubbles:true})); return e&&e.files?e.files.length:-1;})()`);
}

// ─── Photo download (silent, dedicated folder) ────────────────────────────────

function downloadPhoto(url: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename: `anzeigenboost/${name}`, conflictAction: 'overwrite' }, (id) => {
      if (chrome.runtime.lastError || id == null) {
        reject(new Error(chrome.runtime.lastError?.message || 'dl failed'));
        return;
      }
      const onChanged = (d: chrome.downloads.DownloadDelta) => {
        if (d.id !== id || !d.state) return;
        if (d.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(onChanged);
          chrome.downloads.search({ id }, (items) => {
            if (chrome.runtime.lastError) {
              reject(new Error('downloads.search error: ' + chrome.runtime.lastError.message));
              return;
            }
            items?.[0]?.filename ? resolve(items[0].filename) : reject(new Error('no path'));
          });
        } else if (d.state.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(onChanged);
          reject(new Error('dl interrupted'));
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  });
}

// ─── Capture ──────────────────────────────────────────────────────────────────

interface Captured { title: string; price: string; description: string; categoryId: string; priceType: string; photoUrls: string[]; }

async function captureAd(target: Target, adId: string): Promise<Captured> {
  log('capture: opening edit page');
  await navigate(target, `https://www.kleinanzeigen.de/p-anzeige-bearbeiten.html?adId=${adId}`);
  const cur = await evaluate(target, 'location.href');
  if (String(cur).includes('login')) throw new Error('SESSION_EXPIRED');

  const fields = await evaluate(target, `(() => ({
    title: (document.querySelector('#ad-title')||{}).value || '',
    price: (document.querySelector('#ad-price-amount')||{}).value || '',
    description: (document.querySelector('#ad-description')||{}).value || '',
    categoryId: (document.querySelector('input[name="categoryId"]')||{}).value || '',
    priceType: (document.querySelector('input[name="priceType"]')||{}).value || '',
  }))()`);
  log('capture: fields', fields);

  log('capture: opening detail page for photos');
  await navigate(target, `https://www.kleinanzeigen.de/s-anzeige/${adId}`);
  const photoUrls: string[] = await evaluate(target, `(() => {
    const set = new Set();
    document.querySelectorAll('img[src*="img.kleinanzeigen.de/api/v1/prod-ads/images"]').forEach(i => {
      const base = i.src.split('?')[0];
      set.add(base + '?rule=$_57.JPG');
    });
    return [...set];
  })()`);
  log('capture: photo urls', photoUrls.length);

  return { ...fields, photoUrls };
}

// ─── Create (duplicate) ─────────────────────────────────────────────────────

async function createAd(target: Target, data: Captured, photoPaths: string[]): Promise<string> {
  log('create: opening post form');
  await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html');

  // Reach the detailed form (#ad-title). The flow may land on a category step;
  // we log what we see so we can adapt selectors if needed.
  let hasForm = await evaluate(target, `!!document.querySelector('#ad-title')`);
  if (!hasForm) {
    log('create: #ad-title not present yet — current url:', await evaluate(target, 'location.href'));
    // Try going straight to step 2.
    await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html');
    hasForm = await evaluate(target, `!!document.querySelector('#ad-title')`);
  }
  if (!hasForm) throw new Error('could not reach the post form (#ad-title missing)');

  log('create: filling title → triggers category auto-suggest');
  await evaluate(target, fillExpr('#ad-title', data.title || 'Anzeige'));
  await delay(2500); // let KA auto-suggest the category
  await evaluate(target, fillExpr('#ad-price-amount', String(data.price || '')));
  await evaluate(target, fillExpr('#ad-description', data.description || ''));
  log('create: filled fields; categoryId now =', await evaluate(target, `(document.querySelector('input[name="categoryId"]')||{}).value||''`));

  if (photoPaths.length) {
    const n = await setFileInput(target, 'input[type="file"][accept*="image"]', photoPaths);
    log('create: photos attached, input.files.length =', n);
    await delay(4000); // let uploads process / previews render
  }

  log('create: clicking "Anzeige aufgeben"');
  const clicked = await evaluate(target, clickByTextExpr('Anzeige aufgeben'));
  log('create: submit click =', clicked);
  await delay(4000);

  const finalUrl = await evaluate(target, 'location.href');
  log('create: final url =', finalUrl);
  return String(finalUrl);
}

// ─── Delete ────────────────────────────────────────────────────────────────────

async function deleteAd(target: Target, adId: string): Promise<void> {
  log('delete: opening My Ads page');
  await navigate(target, 'https://www.kleinanzeigen.de/m-meine-anzeigen.html?tab=PROJECTS');

  // Find the ad card and click delete button by Löschen text
  log('delete: looking for ad', adId);
  const deleteResult = await evaluate(target, `(() => {
    try {
      // Find button with "Löschen" text (more resilient than class names)
      const buttons = [...document.querySelectorAll('button')];
      const deleteBtn = buttons.find(b => (b.textContent || '').trim().includes('Löschen') && b.offsetParent !== null);
      if (!deleteBtn) return 'DELETE_BUTTON_NOT_FOUND';
      deleteBtn.click();
      return 'CLICKED';
    } catch (e) {
      return 'ERROR: ' + e.message;
    }
  })()`);
  log('delete: delete button click result =', deleteResult);
  if (deleteResult !== 'CLICKED') throw new Error('Delete button not found or not clickable');

  await delay(1500);

  // Handle confirmation modal (Ja, löschen)
  log('delete: waiting for confirmation modal');
  const confirmResult = await evaluate(target, `(() => {
    try {
      const buttons = [...document.querySelectorAll('button')];
      const confirmBtn = buttons.find(b => (b.textContent || '').trim().includes('Ja') && (b.textContent || '').includes('löschen') && b.offsetParent !== null);
      if (!confirmBtn) return 'CONFIRM_NOT_FOUND';
      confirmBtn.click();
      return 'CONFIRMED';
    } catch (e) {
      return 'ERROR: ' + e.message;
    }
  })()`);
  log('delete: confirmation click result =', confirmResult);
  await delay(2000);
}

// ─── Orchestrator (full repost: delete + create) ─────────────────────────────

export async function executeRepostFullFlow(tabId: number, adId: string): Promise<{ ok: boolean; step: string; finalUrl?: string; error?: string }> {
  const target: Target = { tabId };
  let step = 'attach';
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(target, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
    await cdp(target, 'Page.enable').catch(() => {});
    await cdp(target, 'DOM.enable').catch(() => {});
    log('▶ repost (full flow: delete + create) start ad=', adId);

    step = 'capture';
    const data = await captureAd(target, adId);
    if (!data.title) throw new Error('captured empty title — wrong page or not logged in');

    step = 'download_photos';
    const paths: string[] = [];
    for (let i = 0; i < data.photoUrls.length; i++) {
      try { paths.push(await downloadPhoto(data.photoUrls[i], `repost-${adId}-${i}.jpg`)); }
      catch (e: any) { log('photo', i, 'download failed:', e.message); }
    }
    log('downloaded', paths.length, '/', data.photoUrls.length, 'photos');
    if (data.photoUrls.length && paths.length === 0) throw new Error('no photos downloaded — aborting (would create photoless ad)');

    step = 'delete';
    await deleteAd(target, adId);

    step = 'create';
    const finalUrl = await createAd(target, data, paths);

    await new Promise<void>((r) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          log('debugger.detach error:', chrome.runtime.lastError.message);
        }
        r();
      });
    });
    log('■ done. Repost complete — old ad deleted, new ad created.');
    return { ok: true, step, finalUrl };
  } catch (e: any) {
    log('✗ failed at step', step, ':', e.message);
    await new Promise<void>((r) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          log('debugger.detach error during cleanup:', chrome.runtime.lastError.message);
        }
        r();
      });
    }).catch(() => {});
    return { ok: false, step, error: e.message };
  }
}

// ─── Legacy: create-only (v1) ──────────────────────────────────────────────────

export async function executeRepostCreateOnly(tabId: number, adId: string): Promise<{ ok: boolean; step: string; finalUrl?: string; error?: string }> {
  const target: Target = { tabId };
  let step = 'attach';
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(target, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
    await cdp(target, 'Page.enable').catch(() => {});
    await cdp(target, 'DOM.enable').catch(() => {});
    log('▶ repost (create-only) start ad=', adId);

    step = 'capture';
    const data = await captureAd(target, adId);
    if (!data.title) throw new Error('captured empty title — wrong page or not logged in');

    step = 'download_photos';
    const paths: string[] = [];
    for (let i = 0; i < data.photoUrls.length; i++) {
      try { paths.push(await downloadPhoto(data.photoUrls[i], `repost-${adId}-${i}.jpg`)); }
      catch (e: any) { log('photo', i, 'download failed:', e.message); }
    }
    log('downloaded', paths.length, '/', data.photoUrls.length, 'photos');
    if (data.photoUrls.length && paths.length === 0) throw new Error('no photos downloaded — aborting (would create photoless ad)');

    step = 'create';
    const finalUrl = await createAd(target, data, paths);

    await new Promise<void>((r) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          log('debugger.detach error:', chrome.runtime.lastError.message);
        }
        r();
      });
    });
    log('■ done. Check Kleinanzeigen for a NEW duplicate ad with photos.');
    return { ok: true, step, finalUrl };
  } catch (e: any) {
    log('✗ failed at step', step, ':', e.message);
    await new Promise<void>((r) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          log('debugger.detach error during cleanup:', chrome.runtime.lastError.message);
        }
        r();
      });
    }).catch(() => {});
    return { ok: false, step, error: e.message };
  }
}
