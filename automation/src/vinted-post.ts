import { BrowserContext, Page, Browser, chromium } from 'playwright';
import { getPersistentContext } from './browser-manager';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const UNSUPPORTED_CATEGORIES = [
  'Auto, Rad & Boot',
  'Immobilien',
  'Jobs',
  'Dienstleistungen',
  'Nachbarschaft',
  'Eintrittskarten & Tickets'
];

const CATEGORY_PATHS: Record<string, string[]> = {
  'Mode & Beauty': ['Damen', 'Kleidung'],
  'Familie, Kind & Baby': ['Kinder', 'Pflege & Zubehör'],
  'Spielzeug': ['Kinder', 'Spielzeug'],
  'Musik, Filme & Bücher': ['Entertainment', 'Bücher'],
  'Haus & Garten': ['Home', 'Wohnen', 'Dekoration'],
  'Sport & Outdoor': ['Home', 'Sport'],
  'Elektronik': ['Entertainment', 'Videospiele'],
  'Haustiere': ['Home', 'Haustierbedarf'],
  'Musik & Instrumente': ['Entertainment', 'Musik'],
  'Beauty & Gesundheit': ['Damen', 'Beauty-Produkte'],
  'Büro & Schreibwaren': ['Home', 'Wohnen'],
  'Antiquitäten & Kunst': ['Home', 'Wohnen', 'Dekoration'],
  'Freizeit, Hobby & Nachbarschaft': ['Home', 'Wohnen'],
  'Sonstiges': ['Home', 'Wohnen']
};

export async function executeVintedPost(
  userId: string,
  adData: any,
  cookies: any[]
): Promise<{ success: boolean; vintedId?: string; vintedUrl?: string; error?: string }> {
  
  // 1. Instantly check unsupported categories before launching browser
  if (UNSUPPORTED_CATEGORIES.includes(adData.category)) {
    return { success: false, error: 'categoryNotSupported' };
  }

    let page: Page | null = null;
  const tempFiles: string[] = [];
  let tempDir = '';

  try {
    const context = await getPersistentContext(userId);
    
    // Inject Vinted cookies
    const sanitizedCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.vinted.de',
      path: c.path || '/'
    }));
    await context.addCookies(sanitizedCookies);

    page = context.pages().find(p => p.url() !== 'about:blank' || context.pages().length === 1) || await context.newPage();
    if (page.url() !== 'about:blank') {
      page = await context.newPage();
    }

    // 2. Go to Vinted create page
    await page.goto('https://www.vinted.de/items/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept Cookies Consent if visible
    const consentBtn = page.locator('#onetrust-accept-btn-handler');
    if (await consentBtn.isVisible()) {
      await consentBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 3. Check if session has expired (if redirected to login page)
    if (page.url().includes('/member/login') || await page.locator('input[name="password"]').isVisible()) {
      return { success: false, error: 'sessionExpired' };
    }

    // 4. Download images and upload
    let imageUrls: string[] = [];
    if (Array.isArray(adData.images) && adData.images.length > 0) {
      imageUrls = adData.images;
    } else if (adData.image) {
      imageUrls = [adData.image];
    }
    const publicImages = imageUrls.filter(url => url && url.startsWith('http')).slice(0, 20);

    if (publicImages.length > 0) {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vinted-uploads-'));
      for (let i = 0; i < publicImages.length; i++) {
        try {
          const imgResponse = await axios.get(publicImages[i], { responseType: 'arraybuffer' });
          const localPath = path.join(tempDir, `img_${i}.jpg`);
          fs.writeFileSync(localPath, imgResponse.data);
          tempFiles.push(localPath);
        } catch (downloadErr: any) {
          console.warn(`Could not download image ${publicImages[i]}:`, downloadErr.message);
        }
      }

      if (tempFiles.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(tempFiles);
        await page.waitForTimeout(3000); // Wait for upload spinner
      }
    }

    // 5. Fill Title and Description
    const cleanTitle = (adData.title || '').replace(/<\/?[^>]+(>|$)/g, ''); // Strip html tags
    await page.locator('input[name="title"], input[id="title"]').first().fill(cleanTitle);
    await page.waitForTimeout(500);

    await page.locator('textarea[name="description"], textarea[id="description"]').first().fill(adData.description || '');
    await page.waitForTimeout(500);

    // 6. Select Category
    const categoryPath = CATEGORY_PATHS[adData.category];
    if (categoryPath) {
      // Click Category trigger
      await page.locator('div[class*="category-select"], button[class*="category-select"], [data-testid="category-select"]').first().click();
      await page.waitForTimeout(1000);

      for (const text of categoryPath) {
        const option = page.locator(`text="${text}"`).first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await page.waitForTimeout(800);
      }
    }

    // 7. Brand Selection (Ohne Marke / No brand)
    const brandInput = page.locator('input[placeholder*="Marke"], input[id="brand"]').first();
    if (await brandInput.isVisible()) {
      await brandInput.fill('Ohne Marke');
      await page.waitForTimeout(1000);
      const autocompleteOption = page.locator('ul[class*="dropdown"] li, div[class*="suggestion"], li:has-text("Ohne Marke")').first();
      if (await autocompleteOption.isVisible()) {
        await autocompleteOption.click();
      }
    }

    // 8. Condition mapping & selection
    const conditionMap: Record<string, string> = {
      'Neu': 'Neu mit Etikett',
      'Wie neu': 'Sehr gut',
      'Gut': 'Gut',
      'In Ordnung': 'Zufriedenstellend',
      'Defekt': 'Zufriedenstellend'
    };
    const conditionText = conditionMap[adData.condition] || 'Sehr gut';
    const conditionOption = page.locator(`text="${conditionText}"`).first();
    if (await conditionOption.isVisible()) {
      await conditionOption.click();
      await page.waitForTimeout(500);
    }

    // 9. Fill Price
    let priceStr = '0';
    if (adData.price) {
      if (typeof adData.price === 'number') {
        priceStr = Math.round(adData.price).toString();
      } else {
        const cleaned = adData.price.replace(/[^\d]/g, '');
        priceStr = cleaned || '0';
      }
    }
    const priceInput = page.locator('input[name="price"], input[id="price"]').first();
    await priceInput.fill(priceStr);
    await page.waitForTimeout(500);

    // 10. Click Publish Button (Hinzufügen)
    const publishBtn = page.locator('button:has-text("Hinzufügen"), button[type="submit"]').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 35000 }).catch(() => {}),
      publishBtn.click()
    ]);

    await page.waitForTimeout(3000);

    // 11. Extract Listing details from final URL
    const finalUrl = page.url();
    const idMatch = finalUrl.match(/items\/(\d+)/);
    if (!idMatch) {
      throw new Error('Hochladen erfolgreich, konnte aber die Artikel-URL nicht auslesen.');
    }

    const vintedId = idMatch[1];
    await page.close();

    return {
      success: true,
      vintedId,
      vintedUrl: finalUrl
    };

  } catch (error: any) {
    if (page) await page.close().catch(() => {});
    return {
      success: false,
      error: error.message || 'Fehler beim Posten auf Vinted.'
    };
  } finally {
    // Cleanup temporary files
    for (const filePath of tempFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {}
    }
    if (tempDir) {
      try {
        fs.rmdirSync(tempDir);
      } catch (err) {}
    }
  }
}
