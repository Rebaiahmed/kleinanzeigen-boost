import { BrowserContext, Page } from 'playwright';
import { getPersistentContext } from './browser-manager';

export async function executeScrapeAdViews(
  userId: string,
  cookies: any[],
  adId: string
): Promise<{ success: boolean; views?: number; error?: string }> {
  let page: Page | null = null;
  try {
    const context = await getPersistentContext(userId);
    
    // Sanitize cookies
    const sanitizedCookies = cookies.map((c: any) => {
      const validSameSite = ['Strict', 'Lax', 'None'];
      return {
        ...c,
        sameSite: validSameSite.includes(c.sameSite) ? c.sameSite : 'Lax',
      };
    });

    await context.addCookies(sanitizedCookies);
    page = context.pages().find(p => p.url() !== 'about:blank' || context.pages().length === 1) || await context.newPage();
    if (page.url() !== 'about:blank') {
      page = await context.newPage();
    }
    
    // Navigate to the ad detail page
    const adUrl = `https://www.kleinanzeigen.de/s-anzeige/${adId}`;
    await page.goto(adUrl, { waitUntil: 'domcontentloaded' });
    
    // Read the view count element from the DOM
    const views = await page.evaluate(() => {
      // 1. Try standard selectors for views on the details page
      const selectors = ['#viewad-cnt-views', '.viewad-cnt-views', '#viewad-views'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const val = parseInt(el.textContent?.replace(/[^\d]/g, '') || '', 10);
          if (!isNaN(val)) return val;
        }
      }
      
      // 2. Fallback text search for "Aufrufe" or "Aufruf"
      const bodyText = document.body.innerText;
      const match = bodyText.match(/(\d+[\d\s.,]*)\s*Aufrufe?/i);
      if (match) {
        const val = parseInt(match[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(val)) return val;
      }
      return null;
    });

    await page.close();

    if (views === null) {
      return { success: false, error: 'Could not extract views from page' };
    }

    return { success: true, views };

  } catch (error: any) {
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
    return { 
      success: false, 
      error: error.message || 'Unknown error scraping ad views' 
    };
  }
}
