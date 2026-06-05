import { BrowserContext, Page, Browser, chromium } from 'playwright';
import { getPersistentContext } from './browser-manager';
import crypto from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AutomationSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  timeoutId: NodeJS.Timeout;
}

export const activeSessions = new Map<string, AutomationSession>();

// ─── Headless / automated login (existing behaviour) ───────────────────────

export async function executeLoginFlow(
  userId: string,
  email: string,
  password: string,
): Promise<{ success: boolean; cookies?: any; error?: string; requires_2fa?: boolean; sessionId?: string }> {
  const context = await getPersistentContext(userId);
  let page: Page = context.pages().find(p => p.url() !== 'about:blank' || context.pages().length === 1) || await context.newPage();
  if (page.url() !== 'about:blank') {
    page = await context.newPage();
  }

  try {
    // Go to login page (which redirects to Auth0)
    await page.goto('https://www.kleinanzeigen.de/m-einloggen.html', { waitUntil: 'domcontentloaded' });
    await randomDelay(1500, 3000);

    // Accept cookies if Kleinanzeigen banner appears before redirect
    const cookieBtn = 'button[id="gdpr-banner-accept"]';
    if (await page.isVisible(cookieBtn)) {
      await page.click(cookieBtn).catch(() => {});
      await randomDelay(1000, 2000);
    }

    // Wait for Auth0 Identifier screen
    await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 });

    // Fill email (Auth0 uses name="username")
    const emailInput = await page.locator('input[name="username"], input[type="email"]').first();
    await emailInput.fill(email);
    await randomDelay(500, 1500);

    // Press Enter to submit the first screen
    await emailInput.press('Enter');
    await randomDelay(2000, 3000);

    // Wait for Password screen
    await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });

    // Fill password
    const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(password);
    await randomDelay(1000, 2000);

    // Press Enter to submit and wait for redirect back to Kleinanzeigen
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      passwordInput.press('Enter')
    ]);

    await randomDelay(3000, 5000);

    // Check for failure (error message on screen)
    const errorSelector = '.field-error, .alert-danger, [data-testid="login-error"], .ulp-error-info';
    if (await page.isVisible(errorSelector)) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check for 2FA SMS Screen
    const mfaSelector = 'input[name="code"], input[name="otp"], #mfa-code, .mfa-challenge, [inputmode="numeric"]';
    if (await page.isVisible(mfaSelector)) {
      const sessionId = crypto.randomUUID();

      // Keep browser alive for 5 minutes waiting for user input
      const timeoutId = setTimeout(async () => {
        if (activeSessions.has(sessionId)) {
          console.log(`Cleaning up expired 2FA session: ${sessionId}`);
          await activeSessions.get(sessionId)?.browser.close().catch(() => {});
          activeSessions.delete(sessionId);
        }
      }, 5 * 60 * 1000);

      const browser = context.browser()!;
      activeSessions.set(sessionId, { browser, context, page, timeoutId });

      return { success: false, requires_2fa: true, sessionId };
    }

    // Verify we successfully redirected back to Kleinanzeigen
    const finalUrl = page.url();
    if (finalUrl.includes('login.kleinanzeigen.de')) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check for CAPTCHA
    if (await page.isVisible('iframe[src*="captcha"]')) {
      throw new Error('CAPTCHA_DETECTED');
    }

    // Extract state
    const storageState = await context.storageState();
    const cookies = storageState.cookies;

    await page.close();
    return { success: true, cookies };
  } catch (error: any) {
    await page.close().catch(() => {});
    return {
      success: false,
      error: error.message || 'Unknown error during login automation'
    };
  }
}

// ─── Visible browser login (non-headless, user completes CAPTCHA) ───────────

/**
 * The selector that indicates a successful Kleinanzeigen login.
 * Multiple fallbacks in case the DOM structure changes.
 */
const POST_LOGIN_SELECTORS = [
  '#user-profile-link',               // main navbar username link
  '[data-testid="user-menu"]',        // alternative nav element
  'a[href*="/m-meine-anzeigen"]',     // "Meine Anzeigen" nav link only shown when logged in
  '.usernav--username',               // class-based fallback
];

const POLL_INTERVAL_MS = 2000;
const LOGIN_TIMEOUT_MS = 120_000;

export async function executeVisibleLoginFlow(
  jobId: string,
  email: string,
  onStatusUpdate: (status: 'waiting-for-user' | 'success' | 'failed', cookies?: any, error?: string) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch({
    headless: false, // Non-headless so user sees the browser
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Navigate to Kleinanzeigen login page
    await page.goto('https://www.kleinanzeigen.de/m-einloggen.html', { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    // Accept cookies banner if present
    const cookieBtn = 'button[id="gdpr-banner-accept"]';
    if (await page.isVisible(cookieBtn)) {
      await page.click(cookieBtn).catch(() => {});
      await sleep(1500);
    }

    // Pre-fill email so the user only needs to handle password/CAPTCHA
    try {
      await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 8000 });
      const emailInput = page.locator('input[name="username"], input[type="email"]').first();
      await emailInput.fill(email);
      await sleep(600);
      await emailInput.press('Enter');
    } catch {
      // Email pre-fill failed — browser is still open, user can type it
      console.warn('[VisibleLogin] Could not pre-fill email, continuing anyway');
    }

    // Notify status: waiting for user
    await onStatusUpdate('waiting-for-user');

    // Poll until we see a post-login indicator or timeout
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let loggedIn = false;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      // Check if the browser was closed by the user
      if (!browser.isConnected()) {
        await onStatusUpdate('failed', undefined, 'Browser wurde geschlossen');
        return;
      }

      // Check current URL — Kleinanzeigen redirects away from login domain after success
      const currentUrl = page.url();
      if (currentUrl.includes('login.kleinanzeigen.de') || currentUrl.includes('sso.kleinanzeigen.de')) {
        continue; // Still on login page
      }

      // Poll for post-login element
      for (const selector of POST_LOGIN_SELECTORS) {
        try {
          const visible = await page.isVisible(selector).catch(() => false);
          if (visible) {
            loggedIn = true;
            break;
          }
        } catch {
          // Ignore per-selector errors
        }
      }

      if (loggedIn) break;
    }

    if (!loggedIn) {
      await browser.close().catch(() => {});
      await onStatusUpdate('failed', undefined, 'Login-Timeout: Bitte innerhalb von 2 Minuten einloggen');
      return;
    }

    // Capture session cookies
    const storageState = await context.storageState();
    await browser.close().catch(() => {});
    await onStatusUpdate('success', storageState.cookies);

  } catch (error: any) {
    if (browser) await browser.close().catch(() => {});
    await onStatusUpdate('failed', undefined, error.message || 'Unbekannter Fehler beim sichtbaren Login');
  }
}

// ─── 2FA flow (existing) ────────────────────────────────────────────────────

export async function submit2FAFlow(sessionId: string, code: string): Promise<{ success: boolean; cookies?: any; error?: string }> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session expired or invalid' };
  }

  const { browser, context, page, timeoutId } = session;
  clearTimeout(timeoutId);

  try {
    const codeInput = await page.locator('input[name="code"], input[name="otp"], #mfa-code, [inputmode="numeric"]').first();
    await codeInput.fill(code);
    await randomDelay(1000, 2000);

    // Submit code
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      codeInput.press('Enter')
    ]);

    await randomDelay(3000, 5000);

    // Check if error message appeared
    const errorSelector = '.field-error, .alert-danger, [data-testid="login-error"], .ulp-error-info';
    if (await page.isVisible(errorSelector)) {
      throw new Error('INVALID_2FA_CODE');
    }

    // Verify redirect
    const finalUrl = page.url();
    if (finalUrl.includes('login.kleinanzeigen.de')) {
      throw new Error('INVALID_2FA_CODE');
    }

    const storageState = await context.storageState();
    return { success: true, cookies: storageState.cookies };

  } catch (error: any) {
    return { success: false, error: error.message || 'Error submitting 2FA' };
  } finally {
    await browser.close().catch(() => {});
    activeSessions.delete(sessionId);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export const randomDelay = async (min = 1000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  await sleep(ms);
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
