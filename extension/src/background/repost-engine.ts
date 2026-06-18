/**
 * Client-side repost engine — instant ("Jetzt") repost using CDP.
 * Full flow: delete old ad → download photos → create new ad → fill form → upload photos → submit.
 */

import { ENDPOINTS } from '../config/endpoints';

type Target = chrome.debugger.Debuggee;

interface AdData {
  id: string;
  title: string;
  description: string;
  price: number | string;
  pictures?: string[];  // Backend stores photos here
  images?: { url: string }[];
  imageUrls?: string[];
}

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

/** Evaluate JS in page. */
async function evaluate(target: Target, expression: string): Promise<any> {
  const r = await cdp(target, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

/** Navigate and wait for page load. */
async function navigate(target: Target, url: string): Promise<void> {
  await cdp(target, 'Page.navigate', { url });
  for (let i = 0; i < 40; i++) {
    await delay(300);
    try { if ((await evaluate(target, 'document.readyState')) === 'complete') break; } catch { }
  }
  await delay(1500);
}

/** Click button by text. */
function clickExpr(text: string): string {
  const t = JSON.stringify(text);
  return `(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => (b.textContent || '').includes(${t}) && b.offsetParent !== null);
    if (!btn) return 'NOT_FOUND';
    btn.click();
    return 'OK';
  })()`;
}

/** Download photos from URLs. */
async function downloadPhotos(urls: string[]): Promise<File[]> {
  const files: File[] = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        log(`⚠ failed to download ${url}: ${resp.status}`);
        continue;
      }
      const blob = await resp.blob();
      const filename = url.split('/').pop()?.split('?')[0] || `photo-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      files.push(file);
      log(`✓ downloaded ${filename} (${blob.size} bytes)`);
    } catch (e: any) {
      log(`⚠ download failed for ${url}:`, e.message);
    }
  }
  return files;
}

/** Upload real downloaded photos to file input via base64 transfer. */
async function setFileInputViaDataTransfer(target: Target, fileBlobs: Blob[]): Promise<void> {
  if (fileBlobs.length === 0) {
    log('no files to upload');
    return;
  }

  const selector = 'input[type="file"][multiple]';
  const hasInput = await evaluate(target, `!!document.querySelector('${selector}')`);
  if (!hasInput) {
    log('⚠ file input not found:', selector);
    return;
  }

  try {
    log(`converting ${fileBlobs.length} blobs to base64 for upload`);

    // Convert blobs to base64 strings
    const base64Files = await Promise.all(
      fileBlobs.map(async (blob, i) => {
        const buf = await blob.arrayBuffer();
        const arr = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < arr.length; j++) {
          binary += String.fromCharCode(arr[j]);
        }
        const b64 = btoa(binary);
        const filename = `photo-${i}-${Date.now()}.jpg`;
        return { b64, filename, type: blob.type || 'image/jpeg' };
      })
    );

    log(`uploading ${base64Files.length} photos to file input`);

    // Inject script that converts base64 back to blobs and sets file input
    const filesJson = JSON.stringify(base64Files);
    const injection = `(() => {
      const input = document.querySelector('${selector}');
      if (!input) { console.log('[AB-photo] input not found'); return 'NOT_FOUND'; }

      const fileData = ${filesJson};
      const dt = new DataTransfer();

      fileData.forEach((file, i) => {
        try {
          const binary = atob(file.b64);
          const arr = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            arr[j] = binary.charCodeAt(j);
          }
          const blob = new Blob([arr], { type: file.type });
          const fileObj = new File([blob], file.filename, { type: file.type });
          dt.items.add(fileObj);
          console.log('[AB-photo] added ' + file.filename + ' (' + blob.size + ' bytes)');
        } catch (e) {
          console.error('[AB-photo] conversion failed:', e.message);
        }
      });

      if (dt.files.length > 0) {
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('[AB-photo] set ' + dt.files.length + ' files to input');
        return 'OK:' + dt.files.length;
      }
      return 'EMPTY';
    })()`;

    const result = await evaluate(target, injection);
    log('photo upload result:', result);
    await delay(2000);
  } catch (e: any) {
    log('⚠ file upload failed:', e.message);
  }
}

/** Fill form field. */
async function fillField(target: Target, selector: string, value: string): Promise<void> {
  const expr = `(() => {
    const el = document.querySelector('${selector}');
    if (!el) return 'NOT_FOUND';
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'OK:' + el.value.slice(0, 20);
  })()`;
  const result = await evaluate(target, expr);
  log(`fillField ${selector}:`, result);
}

/** Fill all form fields from ad data. */
async function fillFormFields(target: Target, ad: AdData): Promise<void> {
  log('filling form fields');
  if (ad.title) await fillField(target, 'input#ad-title', ad.title);
  if (ad.description) await fillField(target, 'textarea#ad-description', ad.description);
  if (ad.price) await fillField(target, 'input#ad-price-amount', String(ad.price));
  log('form fields filled');
}

/** Submit form by clicking button. */
async function submitForm(target: Target): Promise<void> {
  log('submitting form');
  const submitExpr = `(() => {
    const btn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').toLowerCase().includes('weiter') ||
      (b.textContent || '').toLowerCase().includes('bestätigen') ||
      (b.textContent || '').toLowerCase().includes('anzeige') ||
      b.getAttribute('data-testid')?.includes('submit')
    );
    if (!btn) return 'NOT_FOUND';
    btn.click();
    return 'OK';
  })()`;
  const result = await evaluate(target, submitExpr);
  log('submit result:', result);
}

/** Main repost: delete old ad, create new ad with data. */
export async function executeRepostFullFlow(tabId: number, adId: string, adData?: AdData): Promise<{ ok: boolean; step: string; finalUrl?: string; error?: string }> {
  const target: Target = { tabId };
  let step = 'attach';
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(target, '1.3', () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
      });
    });
    await cdp(target, 'Page.enable').catch(() => {});
    await cdp(target, 'DOM.enable').catch(() => {});

    log('▶ repost start ad=', adId);

    // Delete old ad
    step = 'delete_ad';
    log('navigating to My Ads');
    await navigate(target, 'https://www.kleinanzeigen.de/m-meine-anzeigen.html?tab=PROJECTS');

    log('clicking delete button');
    const delClick = await evaluate(target, clickExpr('Löschen'));
    if (delClick !== 'OK') throw new Error('delete button not found');
    await delay(1500);

    log('confirming delete');
    const confClick = await evaluate(target, clickExpr('Ja'));
    log('confirm result:', confClick);
    await delay(2000);

    // Download photos if available
    step = 'download_photos';
    let downloadedBlobs: Blob[] = [];
    log('ad data:', { title: adData?.title, description: adData?.description?.slice(0, 50), price: adData?.price, pictures: adData?.pictures?.length || 0 });
    if (adData?.pictures?.length || adData?.images?.length || adData?.imageUrls?.length) {
      const photoUrls = adData.pictures || adData.images?.map(img => img.url) || adData.imageUrls || [];
      log(`downloading ${photoUrls.length} photos from:`, photoUrls.slice(0, 2));
      const files = await downloadPhotos(photoUrls);
      downloadedBlobs = files; // Files are also Blobs
      log(`downloaded ${downloadedBlobs.length}/${photoUrls.length} photos`);
    } else {
      log('⚠ no photos in ad data');
    }

    // Create new ad
    step = 'create_ad';
    log('navigating to create page');
    await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html');

    let hasForm = await evaluate(target, `!!document.querySelector('input#ad-title')`);
    if (!hasForm) {
      log('form not on main page, trying step 2');
      await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html');
      hasForm = await evaluate(target, `!!document.querySelector('input#ad-title')`);
    }
    if (!hasForm) throw new Error('form not found');

    log('form is ready, filling fields');
    if (adData) {
      await fillFormFields(target, adData);
      await delay(500);

      // Upload photos
      if (downloadedBlobs.length > 0) {
        step = 'upload_photos';
        await setFileInputViaDataTransfer(target, downloadedBlobs);
        await delay(2000);
      }

      // Submit form
      step = 'submit_form';
      await submitForm(target);
      await delay(3000);

      // Wait for confirmation page (redirects to p-anzeige-aufgeben-bestaetigung.html)
      let confirmationReached = false;
      for (let i = 0; i < 20; i++) {
        const currentUrl = await evaluate(target, 'location.href');
        log('current url:', currentUrl);
        if (currentUrl.includes('p-anzeige-aufgeben-bestaetigung.html')) {
          confirmationReached = true;
          log('✓ reached confirmation page');

          // Extract new ad ID from URL
          const newAdIdMatch = currentUrl.match(/adId=(\d+)/);
          const newAdId = newAdIdMatch ? newAdIdMatch[1] : null;
          log('new ad ID:', newAdId);

          // Redirect to frontend dashboard
          await delay(1000);
          const dashboardUrl = ENDPOINTS.DASHBOARD_BASE;
          log('redirecting to dashboard:', dashboardUrl);
          await evaluate(target, `window.location.href = '${dashboardUrl}'`);
          break;
        }
        await delay(1000);
      }

      if (!confirmationReached) {
        log('⚠ did not reach confirmation page within timeout');
      }
    }

    const finalUrl = await evaluate(target, 'location.href');
    log('■ done');
    return { ok: true, step, finalUrl };
  } catch (e: any) {
    log('✗ failed:', step, e.message);
    return { ok: false, step, error: e.message };
  } finally {
    await new Promise<void>((r) => { chrome.debugger.detach(target, () => r()); }).catch(() => {});
  }
}

/** Legacy: create-only test. */
export async function executeRepostCreateOnly(tabId: number, adId: string): Promise<{ ok: boolean; step: string; finalUrl?: string; error?: string }> {
  const target: Target = { tabId };
  let step = 'attach';
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(target, '1.3', () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
      });
    });
    await cdp(target, 'Page.enable').catch(() => {});
    await cdp(target, 'DOM.enable').catch(() => {});
    log('▶ create-only start ad=', adId);

    step = 'create';
    await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html');
    let hasForm = await evaluate(target, `!!document.querySelector('#ad-title')`);
    if (!hasForm) {
      await navigate(target, 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html');
      hasForm = await evaluate(target, `!!document.querySelector('#ad-title')`);
    }
    if (!hasForm) throw new Error('form not found');

    log('■ done');
    const finalUrl = await evaluate(target, 'location.href');
    return { ok: true, step, finalUrl };
  } catch (e: any) {
    log('✗ failed:', step, e.message);
    return { ok: false, step, error: e.message };
  } finally {
    await new Promise<void>((r) => { chrome.debugger.detach(target, () => r()); }).catch(() => {});
  }
}
