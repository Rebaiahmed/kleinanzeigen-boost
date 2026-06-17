import { BrowserContext, Page, Response } from 'playwright';
import { getPersistentContext } from './browser-manager';

const MY_ADS_URL = process.env.MARKETPLACE_MY_ADS_URL || 'https://www.kleinanzeigen.de/m-meine-anzeigen.html';
const MARKETPLACE_GATEWAY = process.env.MARKETPLACE_GATEWAY_URL || 'https://gateway.kleinanzeigen.de';

// Helper to mimic human latency
export const randomDelay = async (min = 1000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(resolve => setTimeout(resolve, ms));
};

// FIX: Add jitter to avoid predictable patterns that trigger IP blocks
// Kleinanzeigen detects automation by: exact timing intervals, rapid clicks, no human pauses
export const randomJitter = async (chance = 0.3) => {
  if (Math.random() < chance) {
    // Occasionally add longer pauses (like a human reading)
    const jitterMs = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds extra
    console.log(`[repost] ⏱ Adding jitter pause: ${jitterMs}ms`);
    await new Promise(resolve => setTimeout(resolve, jitterMs));
  }
};

/** Helper to capture response details for diagnostic logging */
function formatResponseDiagnostics(response: Response | null | undefined, pageUrl: string): string {
  if (!response) return `(no response) url=${pageUrl}`;
  const statusStr = `status=${response.status()}`;
  const urlStr = `url=${response.url()}`;
  return `${statusStr} ${urlStr}`;
}

export async function executeRepostFlow(userId: string, adId: string, adData: any, cookies?: any[]): Promise<{ success: boolean; step: string; error?: string }> {
  let page: Page | null = null;
  let currentStep = 'init';

  console.log(`[repost] ▶ start ad=${adId} user=${userId} cookies=${Array.isArray(cookies) ? cookies.length : 0}`);

  try {
    const context = await getPersistentContext(userId);

    // Inject the user's session cookies (same as scrape-views). Without this the
    // context is unauthenticated and the session check below throws a false
    // SESSION_EXPIRED, even though the user's Kleinanzeigen session is valid.
    if (Array.isArray(cookies) && cookies.length > 0) {
      const validSameSite = ['Strict', 'Lax', 'None'];
      const sanitizedCookies = cookies.map((c: any) => ({
        ...c,
        sameSite: validSameSite.includes(c.sameSite) ? c.sameSite : 'Lax',
      }));
      console.log(`[repost] Injecting ${sanitizedCookies.length} cookies: ${sanitizedCookies.map((c: any) => c.name).join(', ')}`);
      await context.addCookies(sanitizedCookies);
    } else {
      console.warn(`[repost] ⚠ NO COOKIES provided — will likely fail auth or see login redirect`);
    }

    // FIX: Always create a fresh page to avoid tab memory leak
    // Close any existing pages first
    for (const existingPage of context.pages()) {
      if (existingPage.url() !== 'about:blank') {
        await existingPage.close().catch(() => {});
      }
    }
    page = await context.newPage();

    // Session Trap Check (PO Note: Always hit /m-meine-anzeigen first)
    currentStep = 'session_check';
    const response = await page.goto(MY_ADS_URL, { waitUntil: 'domcontentloaded' });

    const responseInfo = formatResponseDiagnostics(response, page.url());
    console.log(`[repost] session_check: ${responseInfo}`);

    // Diagnostic: check for 403, login redirects, and block pages
    if (response?.status() === 403) {
      const bodyText = await page.textContent('body')?.catch(() => null);
      console.error(`[repost] 403 Forbidden detected at ${MY_ADS_URL}`);
      console.error(`[repost] Response body (first 500 chars): ${(bodyText || '').slice(0, 500)}`);
      console.error(`[repost] Page URL after navigation: ${page.url()}`);
      throw new Error('403_FORBIDDEN — Kleinanzeigen returned 403 Forbidden. Likely bot detection, missing CSRF token, or IP block.');
    }

    if (page.url().includes('login') || response?.status() === 401) {
      console.error(`[repost] SESSION_EXPIRED: redirected to login or got 401`);
      console.error(`[repost] Final URL: ${page.url()}`);
      throw new Error('SESSION_EXPIRED');
    }

    // Check for block/captcha interstitials
    const bodyText = await page.textContent('body')?.catch(() => '');
    if (bodyText?.includes('ungewöhnliche Aktivität') || bodyText?.includes('unusual activity')) {
      console.error(`[repost] Bot detection page detected: ${bodyText.slice(0, 200)}`);
      throw new Error('IP_BLOCKED — Kleinanzeigen showing bot detection page');
    }

    await randomDelay(1500, 3000);
    await randomJitter(0.4); // 40% chance of extra pause to appear human

    // Step 1: Delete Ad
    currentStep = 'delete_ad';
    const editUrl = `https://www.kleinanzeigen.de/m-anzeige-bearbeiten.html?adId=${adId}`;
    const delResponse = await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    const delResponseInfo = formatResponseDiagnostics(delResponse, page.url());
    console.log(`[repost] delete_ad navigate: ${delResponseInfo}`);

    if (delResponse?.status() === 403) {
      const delBodyText = await page.textContent('body')?.catch(() => null);
      console.error(`[repost] 403 at edit page: ${editUrl}`);
      console.error(`[repost] Response body (first 500 chars): ${(delBodyText || '').slice(0, 500)}`);
      throw new Error('403_FORBIDDEN at edit page');
    }

    await randomDelay(2000, 4000);
    await randomJitter(0.3);

    // Modular Selector: Find and click delete
    const deleteBtnSelector = 'button:has-text("Löschen")';
    if (await page.isVisible(deleteBtnSelector)) {
      console.log(`[repost] Found delete button, clicking...`);
      await randomDelay(300, 800); // Small pause before clicking (human-like)
      await page.click(deleteBtnSelector);
      await randomDelay();

      // Handle "Are you sure?" modal
      const confirmModalSelector = 'button:has-text("Ja, löschen")';
      if (await page.isVisible(confirmModalSelector)) {
        console.log(`[repost] Found confirmation modal, confirming delete...`);
        await page.click(confirmModalSelector);
      }
    } else {
      console.warn(`[repost] Delete button not found on page. Current URL: ${page.url()}`);
      const deletePageBody = await page.textContent('body')?.catch(() => 'N/A');
      console.warn(`[repost] Page content (first 300 chars): ${(deletePageBody || '').slice(0, 300)}`);
    }
    await randomDelay(2000, 5000);

    // Step 2: Verify "Ad Gone"
    currentStep = 'verify_deletion';
    await page.goto(`https://www.kleinanzeigen.de/s-anzeige/${adId}`);
    await randomDelay();

    const verifyBodyText = await page.innerText('body');
    if (!verifyBodyText.includes('Die Anzeige ist nicht mehr verfügbar')) {
      throw new Error('Verification failed: Ad is still live on the marketplace.');
    }

    // Step 3: Create Ad
    currentStep = 'create_ad';
    const createUrl = 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html';
    const createResponse = await page.goto(createUrl, { waitUntil: 'domcontentloaded' });
    const createResponseInfo = formatResponseDiagnostics(createResponse, page.url());
    console.log(`[repost] create_ad navigate: ${createResponseInfo}`);

    if (createResponse?.status() === 403) {
      const createBodyText = await page.textContent('body')?.catch(() => null);
      console.error(`[repost] 403 at create page: ${createUrl}`);
      console.error(`[repost] Response body (first 500 chars): ${(createBodyText || '').slice(0, 500)}`);
      throw new Error('403_FORBIDDEN at create page');
    }

    await randomDelay(2000, 4000);

    // Map cached Ad Schema to form inputs (Modular selectors)
    console.log(`[repost] Filling form: title="${adData.title}" price="${adData.price}"`);
    try {
      await page.fill('input[name="title"]', adData.title || 'Reposted Title');
      await randomDelay();
      await page.fill('textarea[name="description"]', adData.description || 'Reposted description');
      await randomDelay();
      await page.fill('input[name="price"]', adData.price || '10');
      await randomDelay();
    } catch (fillError: any) {
      console.error(`[repost] Error filling form fields: ${fillError.message}`);
      const bodyText = await page.textContent('body')?.catch(() => 'N/A');
      console.error(`[repost] Page content (first 300 chars): ${(bodyText || '').slice(0, 300)}`);
      throw fillError;
    }

    // Handle image uploads (mock)
    // if (adData.images && adData.images.length > 0) {
    //   await page.setInputFiles('input[type="file"]', adData.images);
    //   await randomDelay(3000, 6000);
    // }

    // Click submit
    console.log(`[repost] Submitting form...`);
    const submitBtnText = 'Anzeige aufgeben';
    try {
      await page.click(`button:has-text("${submitBtnText}")`);
    } catch (clickError: any) {
      console.error(`[repost] Could not click submit button: ${clickError.message}`);
      throw clickError;
    }
    await randomDelay(3000, 6000);
    
    // Check for captchas or post-submit modals
    if (await page.isVisible('iframe[src*="captcha"]')) {
      throw new Error('CAPTCHA_DETECTED');
    }

    // Detect an IP block / rate-limit / "unusual activity" interstitial so the
    // scheduler can classify it as IP_BLOCKED (vs a generic failure) and back off.
    try {
      const bodyText = (await page.textContent('body'))?.toLowerCase() || '';
      if (/ungewöhnliche aktivität|unusual activity|zu viele anfragen|too many requests|vorübergehend gesperrt|temporarily blocked|ip-adresse/.test(bodyText)) {
        throw new Error('IP_BLOCKED');
      }
    } catch (e: any) {
      if (e.message === 'IP_BLOCKED') throw e;
      // textContent failure is non-fatal — ignore and continue.
    }
    // FIX: Close the page immediately to free memory
    await page.close().catch(() => {});
    console.log(`[repost] ✓ Page closed successfully`);

    return { success: true, step: currentStep };

  } catch (error: any) {
    const url = page ? page.url() : 'n/a';
    const errorMsg = error?.message || 'Unknown error';

    console.error(`[repost] ✗ FAILED at step='${currentStep}' ad=${adId} url=${url}`);
    console.error(`[repost] Error message: ${errorMsg}`);

    // Capture page body if available (helps identify 403, login page, captcha, etc.)
    if (page) {
      try {
        const bodyText = await page.textContent('body');
        if (bodyText) {
          const preview = bodyText.slice(0, 600);
          console.error(`[repost] Page body (first 600 chars): ${preview}`);
        }
      } catch (bodyError: any) {
        console.error(`[repost] Could not capture page body: ${bodyError.message}`);
      }

      // FIX: Always close page on error to prevent memory leak
      try {
        await page.close();
        console.log(`[repost] Page closed after error`);
      } catch (closeError: any) {
        console.warn(`[repost] Error closing page: ${closeError.message}`);
      }
    }

    if (error?.stack) console.error(`[repost] Stack trace: ${error.stack}`);

    return {
      success: false,
      step: currentStep,
      error: errorMsg,
    };
  }
}
