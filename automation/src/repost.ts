import { BrowserContext, Page } from 'playwright';
import { getPersistentContext } from './browser-manager';

const MY_ADS_URL = process.env.MARKETPLACE_MY_ADS_URL || 'https://www.kleinanzeigen.de/m-meine-anzeigen.html';
const MARKETPLACE_GATEWAY = process.env.MARKETPLACE_GATEWAY_URL || 'https://gateway.kleinanzeigen.de';

// Helper to mimic human latency
export const randomDelay = async (min = 1000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(resolve => setTimeout(resolve, ms));
};

export async function executeRepostFlow(userId: string, adId: string, adData: any): Promise<{ success: boolean; step: string; error?: string }> {
  let page: Page | null = null;
  let currentStep = 'init';

  try {
    const context = await getPersistentContext(userId);
    page = context.pages().find(p => p.url() !== 'about:blank' || context.pages().length === 1) || await context.newPage();
    if (page.url() !== 'about:blank') {
      page = await context.newPage();
    }

    // Session Trap Check (PO Note: Always hit /m-meine-anzeigen first)
    currentStep = 'session_check';
    const response = await page.goto(MY_ADS_URL, { waitUntil: 'domcontentloaded' });
    
    // Check if we got redirected to login or unauthorized
    if (page.url().includes('login') || response?.status() === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    await randomDelay(1500, 3000);

    // Step 1: Delete Ad
    currentStep = 'delete_ad';
    // Navigate to specific ad management page (mocking URL for now)
    await page.goto(`https://www.kleinanzeigen.de/m-anzeige-bearbeiten.html?adId=${adId}`);
    await randomDelay(2000, 4000);

    // Modular Selector: Find and click delete
    const deleteBtnSelector = 'button:has-text("Löschen")';
    if (await page.isVisible(deleteBtnSelector)) {
      await page.click(deleteBtnSelector);
      await randomDelay();
      
      // Handle "Are you sure?" modal
      const confirmModalSelector = 'button:has-text("Ja, löschen")';
      if (await page.isVisible(confirmModalSelector)) {
        await page.click(confirmModalSelector);
      }
    }
    await randomDelay(2000, 5000);

    // Step 2: Verify "Ad Gone"
    currentStep = 'verify_deletion';
    await page.goto(`https://www.kleinanzeigen.de/s-anzeige/${adId}`);
    await randomDelay();
    
    const bodyText = await page.innerText('body');
    if (!bodyText.includes('Die Anzeige ist nicht mehr verfügbar')) {
      throw new Error('Verification failed: Ad is still live on the marketplace.');
    }
    
    // Step 3: Create Ad
    currentStep = 'create_ad';
    await page.goto('https://www.kleinanzeigen.de/p-anzeige-aufgeben.html');
    await randomDelay(2000, 4000);

    // Map cached Ad Schema to form inputs (Modular selectors)
    await page.fill('input[name="title"]', adData.title || 'Reposted Title');
    await randomDelay();
    await page.fill('textarea[name="description"]', adData.description || 'Reposted description');
    await randomDelay();
    await page.fill('input[name="price"]', adData.price || '10');
    await randomDelay();
    
    // Handle image uploads (mock)
    // if (adData.images && adData.images.length > 0) {
    //   await page.setInputFiles('input[type="file"]', adData.images);
    //   await randomDelay(3000, 6000);
    // }

    // Click submit
    await page.click('button:has-text("Anzeige aufgeben")');
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
    // Close the page, not the context, to keep browser alive
    await page.close();

    return { success: true, step: currentStep };

  } catch (error: any) {
    if (page) await page.close().catch(() => {});  return { 
      success: false, 
      step: currentStep, 
      error: error.message || 'Unknown error during automation' 
    };
  }
}
