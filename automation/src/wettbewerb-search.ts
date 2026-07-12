import { Page } from 'playwright';
import { getAnonymousContext } from './browser-manager';
import { randomDelay, randomJitter } from './repost';

export interface CompetitorRow {
  rank: number;
  title: string;
  priceEUR: number | null;
  adId: string;
}

export interface SearchScrapeResult {
  success: true;
  results: CompetitorRow[];
  totalResultsFound: number;
}

/**
 * Same IP-block phrasing check used in repost.ts — reused verbatim rather
 * than duplicated, since the phrasing Kleinanzeigen returns is identical
 * regardless of which page triggered the block.
 */
const IP_BLOCK_RE = /IP-Bereich|gesperrt|ungewöhnliche aktivität|unusual activity|too many requests/i;

/**
 * "320 € VB" -> 320, "990 €" -> 990, "2.000 €" -> 2000, "VB" (no anchor) ->
 * null, "Zu verschenken" -> null, "Tausche" -> null.
 * Verified against a live Kleinanzeigen search-results page — see the
 * price text samples referenced in the Wettbewerb plan.
 */
function parsePriceEUR(raw: string): number | null {
  const cleaned = raw.replace(/VB/i, '').trim();
  if (!cleaned || /verschenken|tausch/i.test(cleaned)) return null;
  const digits = cleaned.replace(/[^\d]/g, '');
  if (!digits) return null;
  return parseInt(digits, 10);
}

/**
 * Scrapes a Kleinanzeigen search-results page for a keyword/PLZ/radius
 * combination. Public/anonymous page — no login, no cookies needed.
 *
 * URL shape and DOM selectors below were verified directly against a live
 * kleinanzeigen.de search-results page before writing this (not guessed):
 *   - https://www.kleinanzeigen.de/s-{keyword}/k0l{plz}r{radiusKm}
 *     accepts a raw 5-digit PLZ directly in the l-segment and a plain km
 *     number (including 0) in the r-segment.
 *   - Each result card is `article.aditem[data-adid]` — data-adid is the
 *     canonical numeric ad ID (same ID space as the ad-detail URL
 *     https://www.kleinanzeigen.de/s-anzeige/{adId} used elsewhere in this
 *     codebase), so no href-regex parsing is needed.
 *   - Title: `h2.text-module-begin a.ellipsis`.
 *   - Price: `.aditem-main--middle--price-shipping--price` (a nested
 *     `.aditem-main--middle--price-shipping--old-price` child must be
 *     stripped before reading the text — it holds the pre-discount price).
 *   - Result count / zero-results text lives in `.breadcrump-summary`,
 *     either "X - Y von Z Ergebnissen für ..." or "Es wurden keine
 *     Ergebnisse für ... gefunden." for zero results.
 * If Kleinanzeigen changes this markup, extraction will legitimately
 * return SCRAPE_MALFORMED_PAGE — that's the intended failure mode, not a
 * bug to silently paper over.
 */
export async function executeSearchScrape(
  keyword: string,
  plz: string,
  radiusKm: number,
): Promise<SearchScrapeResult> {
  const { browser, context } = await getAnonymousContext();
  let page: Page | null = null;
  try {
    page = await context.newPage();

    await randomDelay(1000, 3000);

    const searchUrl = `https://www.kleinanzeigen.de/s-${encodeURIComponent(keyword)}/k0l${encodeURIComponent(plz)}r${radiusKm}`;
    const response = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await randomJitter(0.3);

    const body = (await page.textContent('body').catch(() => '')) || '';
    if (IP_BLOCK_RE.test(body)) {
      throw new Error('IP_BLOCKED — Kleinanzeigen IP-range temporarily blocked (gesperrt).');
    }
    if (response && response.status() === 403) {
      throw new Error('IP_BLOCKED — Kleinanzeigen returned 403 on search.');
    }

    const extracted = await page.evaluate(() => {
      const summaryText = document.querySelector('.breadcrump-summary')?.textContent || '';
      const isZeroResults = /keine Ergebnisse/i.test(summaryText);
      const countMatch = summaryText.match(/von\s+([\d.]+)\s+Ergebnis/i);
      const totalResultsFound = isZeroResults ? 0 : countMatch ? parseInt(countMatch[1].replace(/\./g, ''), 10) : null;

      const cards = Array.from(document.querySelectorAll('article.aditem[data-adid]'));
      const rows = cards.map((card) => {
        const adId = card.getAttribute('data-adid') || '';
        const title = card.querySelector('h2.text-module-begin a.ellipsis')?.textContent?.trim() || '';
        const priceEl = card.querySelector('.aditem-main--middle--price-shipping--price');
        let priceText = '';
        if (priceEl) {
          const clone = priceEl.cloneNode(true) as HTMLElement;
          clone.querySelector('.aditem-main--middle--price-shipping--old-price')?.remove();
          priceText = clone.textContent?.trim() || '';
        }
        return { adId, title, priceText };
      });

      return { totalResultsFound, isZeroResults, rows, summaryPresent: !!document.querySelector('.breadcrump-summary') };
    });

    if (!extracted.summaryPresent) {
      // Not even the results-summary header rendered — page structure has
      // drifted from what we verified, not a real zero-results case.
      throw new Error('SCRAPE_MALFORMED_PAGE — results summary element not found.');
    }

    if (extracted.isZeroResults) {
      return { success: true, results: [], totalResultsFound: 0 };
    }

    if (extracted.rows.length === 0 && (extracted.totalResultsFound === null || extracted.totalResultsFound > 0)) {
      // Summary claims results exist (or couldn't be parsed) but no cards
      // were found — markup drift, not a genuine empty search.
      throw new Error('SCRAPE_MALFORMED_PAGE — result cards not found despite non-zero result count.');
    }

    const results: CompetitorRow[] = extracted.rows
      .filter((r) => r.adId && r.title)
      .map((r, i) => ({
        rank: i + 1,
        title: r.title,
        priceEUR: parsePriceEUR(r.priceText),
        adId: r.adId,
      }));

    return {
      success: true,
      results,
      totalResultsFound: extracted.totalResultsFound ?? results.length,
    };
  } catch (error: any) {
    if (/Timeout.*exceeded/i.test(error.message || '')) {
      throw new Error('SCRAPE_TIMEOUT — navigation to search results timed out.');
    }
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
