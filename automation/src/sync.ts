import { chromium, BrowserContext, Page, Browser } from 'playwright';
import { randomDelay } from './repost';

export interface ScrapedAd {
  id: string;
  title: string;
  category: string;
  price: string;
  views: number;
  favorites: number;
  messages: number;
  date: string;
  status: string;
  image: string;
}

export async function executeSyncAds(cookies: any[]): Promise<{ success: boolean; ads?: ScrapedAd[]; error?: string }> {
  let context: BrowserContext | null = null;
  let browser: Browser | null = null;

  try {
    const isDebug = process.env.DEBUG_BROWSER === 'true';
    browser = await chromium.launch({ headless: !isDebug });
    context = await browser.newContext();
    
    // Sanitize cookies: Playwright only accepts sameSite of Strict | Lax | None
    const sanitizedCookies = cookies.map((c: any) => {
      const validSameSite = ['Strict', 'Lax', 'None'];
      return {
        ...c,
        sameSite: validSameSite.includes(c.sameSite) ? c.sameSite : 'Lax',
      };
    });

    // Inject session cookies
    await context.addCookies(sanitizedCookies);
    
    // Use a real page to bypass Cloudflare/Datadome
    const page = await context.newPage();
    await page.goto('https://www.kleinanzeigen.de/m-meine-anzeigen.html', { waitUntil: 'domcontentloaded' });
    
    if (page.url().includes('login.kleinanzeigen.de') || page.url().includes('m-einloggen')) {
      throw new Error('SESSION_EXPIRED');
    }

    // Execute fetch inside the browser context to perfectly mimic human traffic
    const data = await page.evaluate(async () => {
      const res = await fetch('https://www.kleinanzeigen.de/m-meine-anzeigen-verwalten.json?sort=DEFAULT');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`FETCH_FAILED_STATUS_${res.status}_BODY_${text.substring(0, 100)}`);
      }
      return res.json();
    });

    const rawAds = data.ads || [];
    console.log(`Raw Sync Data keys:`, Object.keys(data));
    if (!data.ads) {
      console.log(`Missing 'ads' array! Full data preview:`, JSON.stringify(data).substring(0, 1000));
    }
    
    const scrapedAds: ScrapedAd[] = rawAds.map((ad: any) => {
      const stateMapping: Record<string, string> = {
        'active': 'Aktiv',
        'paused': 'Pausiert',
        'reserved': 'Reserviert',
        'sold': 'Verkauft'
      };

      return {
        id: ad.id.toString(),
        title: ad.title || '',
        category: ad.category || '',
        price: ad.price || '',
        views: ad.viewCount || 0,
        favorites: ad.watchCount || 0,
        messages: ad.replies || 0,
        date: ad.creationDate || '',
        status: stateMapping[ad.state?.toLowerCase()] || 'Aktiv',
        image: ad.adImage?.url || 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=No+Image'
      };
    });

    await browser.close();
    return { success: true, ads: scrapedAds };

  } catch (error: any) {
    if (browser) await browser.close().catch(() => {});
    return { 
      success: false, 
      error: error.message || 'Unknown error during sync automation' 
    };
  }
}
