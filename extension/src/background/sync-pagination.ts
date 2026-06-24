// Page-walking logic for syncing the Kleinanzeigen "Meine Anzeigen" list, which
// paginates at pageSize=25. Extracted as a pure function so it can be unit-tested
// without a browser/network (see scripts/test-sync-pagination.mjs).

/** Parse the ads array out of one page of the manage-ads JSON. */
export function extractAds(raw: any): any[] {
  return Array.isArray(raw?.ads) ? raw.ads
    : Array.isArray(raw?.listings) ? raw.listings
    : Array.isArray(raw) ? raw : [];
}

export interface CollectOptions {
  maxPages?: number;                       // safety cap against runaway loops
  delayMs?: number;                        // pause between page fetches (throttle)
  sleep?: (ms: number) => Promise<void>;   // injectable for tests
  log?: (msg: string) => void;
}

/**
 * Fetch every page of ads, throttled, deduping by id. Stops early and keeps
 * partial results if a page fails or if the server ignores the page param
 * (returns no new ads). `fetchPage(n)` returns the raw JSON for page n (1-based).
 */
export async function collectAdPages(
  fetchPage: (pageNum: number) => Promise<any>,
  opts: CollectOptions = {},
): Promise<any[]> {
  const maxPages = opts.maxPages ?? 40;
  const delayMs = opts.delayMs ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const log = opts.log ?? (() => {});

  const firstRaw = await fetchPage(1);
  const allAds: any[] = extractAds(firstRaw);
  const seenIds = new Set(allAds.map((a) => String(a.id)));

  const paging = firstRaw?.paging || {};
  const pageSize = Number(paging.pageSize) || 25;
  const lastPage = Math.min(
    Number(paging.last) || Math.ceil((Number(paging.numFound) || allAds.length) / pageSize) || 1,
    maxPages,
  );

  for (let p = 2; p <= lastPage; p++) {
    await sleep(delayMs);
    let pageAds: any[];
    try {
      pageAds = extractAds(await fetchPage(p));
    } catch (e: any) {
      log(`[sync] page ${p}/${lastPage} failed (${e?.message}) — keeping ${allAds.length} ad(s) collected so far`);
      break;
    }
    const fresh = pageAds.filter((a) => !seenIds.has(String(a.id)));
    if (fresh.length === 0) {
      log(`[sync] page ${p} returned no new ads — stopping (page param may be unsupported)`);
      break;
    }
    for (const a of fresh) { seenIds.add(String(a.id)); allAds.push(a); }
    log(`[sync] page ${p}/${lastPage} — ${allAds.length} ad(s) total`);
  }

  return allAds;
}
