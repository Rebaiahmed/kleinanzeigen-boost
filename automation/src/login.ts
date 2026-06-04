import { chromium, BrowserContext, Page, Browser } from 'playwright';
import { randomDelay } from './repost';
import crypto from 'crypto';

interface AutomationSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  timeoutId: NodeJS.Timeout;
}

export const activeSessions = new Map<string, AutomationSession>();

export async function executeLoginFlow(email: string, password: string): Promise<{ success: boolean; cookies?: any; error?: string; requires_2fa?: boolean; sessionId?: string }> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browser: Browser | null = null;

  try {
    const isDebug = process.env.DEBUG_BROWSER === 'true';
    browser = await chromium.launch({ headless: !isDebug });
    context = await browser.newContext();
    page = await context.newPage();

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

    await browser.close();
    return { success: true, cookies: storageState.cookies };

  } catch (error: any) {
    if (browser) await browser.close().catch(() => {});
    return { 
      success: false, 
      error: error.message || 'Unknown error during login automation' 
    };
  }
}

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
