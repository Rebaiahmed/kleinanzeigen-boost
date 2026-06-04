import { chromium, BrowserContext, Page, Browser } from 'playwright';

export async function executeVintedLogin(email: string, password: string): Promise<{ success: boolean; cookies?: any; username?: string; error?: string }> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browser: Browser | null = null;

  try {
    const isDebug = process.env.DEBUG_BROWSER === 'true';
    browser = await chromium.launch({ 
      headless: !isDebug,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();

    // 1. Go to Vinted login page
    await page.goto('https://www.vinted.de/member/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2. Accept Cookie Consent if visible
    const consentBtn = page.locator('#onetrust-accept-btn-handler');
    if (await consentBtn.isVisible()) {
      await consentBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 3. Fill Username/Email and Password
    const usernameInput = page.locator('input[name="username"], input[id="username"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill(email);
    await page.waitForTimeout(500);

    const passwordInput = page.locator('input[name="password"], input[id="password"]').first();
    await passwordInput.fill(password);
    await page.waitForTimeout(500);

    // 4. Click Submit / Login button
    const submitBtn = page.locator('button[type="submit"], button[data-testid="login-submit"]').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
      submitBtn.click()
    ]);

    await page.waitForTimeout(3000);

    // 5. Verify Login Success (check if we are logged in, e.g. login form is gone or profile indicator exists)
    const loginError = page.locator('div[class*="error"], span[class*="error"], div[data-testid="login-error-message"]');
    if (await loginError.isVisible()) {
      const errorMsg = await loginError.first().innerText().catch(() => 'Ungültige Anmeldedaten');
      throw new Error(errorMsg);
    }

    // Check if we are still on login page or have input fields
    if (await page.locator('input[name="password"]').isVisible()) {
      throw new Error('Anmeldung fehlgeschlagen. Bitte überprüfe deine E-Mail und dein Passwort.');
    }

    // 6. Extract Vinted Username from UI
    let username = 'Vinted-Verkäufer';
    try {
      await page.goto('https://www.vinted.de', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      const profileLink = page.locator('a[href*="/member/general"]');
      if (await profileLink.count() > 0) {
        const href = await profileLink.first().getAttribute('href');
        if (href) {
          const parts = href.split('/');
          const lastPart = parts[parts.length - 1];
          // remove digit prefix if exists (e.g. 12345-username)
          username = lastPart.replace(/^\d+-/, '');
        }
      }
    } catch (e: any) {
      console.warn('Could not extract Vinted username:', e.message);
    }

    // 7. Get cookies
    const storageState = await context.storageState();
    
    await browser.close();
    return { 
      success: true, 
      cookies: storageState.cookies,
      username 
    };

  } catch (error: any) {
    if (browser) await browser.close().catch(() => {});
    return { 
      success: false, 
      error: error.message || 'Fehler bei der Vinted-Anmeldung.' 
    };
  }
}
