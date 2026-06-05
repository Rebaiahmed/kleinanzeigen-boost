import { BrowserContext, Page } from 'playwright';
import { getPersistentContext } from './browser-manager';

export async function executeGetAdViews(userId: string, cookies: any[], adId: string): Promise<{ success: boolean; views?: number; error?: string }> {
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
    let page = context.pages().find(p => p.url() !== 'about:blank' || context.pages().length === 1) || await context.newPage();
    if (page.url() !== 'about:blank') {
      page = await context.newPage();
    }
    
    // Navigate to set origin
    await page.goto('https://www.kleinanzeigen.de/m-meine-anzeigen.html', { waitUntil: 'domcontentloaded' });
    
    if (page.url().includes('login.kleinanzeigen.de') || page.url().includes('m-einloggen')) {
      throw new Error('SESSION_EXPIRED');
    }

    // Fetch the JSON
    const data = await page.evaluate(async () => {
      const res = await fetch('https://www.kleinanzeigen.de/m-meine-anzeigen-verwalten.json?sort=DEFAULT');
      if (!res.ok) {
        throw new Error(`Abruf der Anzeigen fehlgeschlagen (HTTP ${res.status}). Bitte lade die Seite neu.`);
      }
      return res.json();
    });

    const rawAds = data.ads || [];
    const targetAd = rawAds.find((a: any) => a.id.toString() === adId.toString());
    
    await page.close();

    if (!targetAd) {
      return { success: false, error: 'AD_NOT_FOUND' };
    }

    return { success: true, views: targetAd.viewCount || 0 };

  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Unknown error fetching ad views' 
    };
  }
}
