// Runnable test for the real sync page-walking logic (collectAdPages).
// Bundles the TS module with esbuild, then exercises it against a mocked KA
// endpoint returning 100 ads across 4 pages — plus edge cases. No browser/network.
//
// Run:  node scripts/test-sync-pagination.mjs   (from the extension/ dir)
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

// Compile the source module to a temp ESM file we can import.
const out = '/tmp/sync-pagination.test-build.mjs';
await build({
  entryPoints: ['src/background/sync-pagination.ts'],
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
});
const { collectAdPages } = await import(pathToFileURL(out).href);

let failures = 0;
const assert = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) failures++;
};

// ── Helper: build a paginated mock KA endpoint with `total` ads, pageSize 25 ──
function makeMockEndpoint(total, pageSize = 25, { ignorePageParam = false, failOnPage = null } = {}) {
  const last = Math.ceil(total / pageSize);
  let calls = 0;
  const fetchPage = async (pageNum) => {
    calls++;
    if (failOnPage && pageNum === failOnPage) throw new Error(`HTTP 500 on page ${pageNum}`);
    const effectivePage = ignorePageParam ? 1 : pageNum; // simulate KA ignoring the param
    const start = (effectivePage - 1) * pageSize;
    const ads = [];
    for (let i = start; i < Math.min(start + pageSize, total); i++) {
      ads.push({ id: 1000 + i, title: `Ad ${i + 1}` });
    }
    return { ads, paging: { pageNum, pageSize, numFound: total, last } };
  };
  return { fetchPage, getCalls: () => calls };
}

const noSleep = async () => {};

// ── Test 1: 100 ads across 4 pages → all collected, in order, no dupes ──
{
  const { fetchPage, getCalls } = makeMockEndpoint(100);
  const ads = await collectAdPages(fetchPage, { sleep: noSleep });
  assert(ads.length === 100, `T1: collected all 100 ads (got ${ads.length})`);
  assert(getCalls() === 4, `T1: fetched exactly 4 pages (got ${getCalls()})`);
  const ids = new Set(ads.map(a => a.id));
  assert(ids.size === 100, `T1: no duplicate ids (${ids.size} unique)`);
  assert(ads[0].title === 'Ad 1' && ads[99].title === 'Ad 100', 'T1: first & last ad correct/in order');
}

// ── Test 2: 6 ads, single page (your real account) ──
{
  const { fetchPage, getCalls } = makeMockEndpoint(6);
  const ads = await collectAdPages(fetchPage, { sleep: noSleep });
  assert(ads.length === 6 && getCalls() === 1, `T2: 6 ads, single fetch (ads=${ads.length}, calls=${getCalls()})`);
}

// ── Test 3: KA ignores the page param → guard stops after page 2, no dupes ──
{
  const { fetchPage, getCalls } = makeMockEndpoint(100, 25, { ignorePageParam: true });
  const ads = await collectAdPages(fetchPage, { sleep: noSleep });
  assert(ads.length === 25, `T3: stops at 25 when page param ignored (got ${ads.length}, no dupes)`);
  assert(getCalls() === 2, `T3: stops after detecting no new ads on page 2 (calls=${getCalls()})`);
}

// ── Test 4: a page fails mid-way → partial results kept ──
{
  const { fetchPage } = makeMockEndpoint(100, 25, { failOnPage: 3 });
  const ads = await collectAdPages(fetchPage, { sleep: noSleep });
  assert(ads.length === 50, `T4: keeps pages 1-2 (50 ads) when page 3 fails (got ${ads.length})`);
}

// ── Test 5: throttle delay is actually applied between pages ──
{
  const { fetchPage } = makeMockEndpoint(100);
  const delays = [];
  await collectAdPages(fetchPage, { delayMs: 500, sleep: async (ms) => { delays.push(ms); } });
  assert(delays.length === 3 && delays.every(d => d === 500), `T5: throttled 500ms before each of 3 extra pages (${delays.join(',')})`);
}

// ── Test 6: maxPages cap honoured (e.g. 1000 ads but cap at 40 pages) ──
{
  const { fetchPage, getCalls } = makeMockEndpoint(2000); // 80 pages worth
  const ads = await collectAdPages(fetchPage, { sleep: noSleep, maxPages: 40 });
  assert(getCalls() === 40, `T6: caps at maxPages=40 (calls=${getCalls()})`);
  assert(ads.length === 1000, `T6: collected 40×25=1000 ads under the cap (got ${ads.length})`);
}

console.log(failures === 0 ? '\n🎉 All sync-pagination tests passed' : `\n💥 ${failures} test(s) failed`);
process.exit(failures === 0 ? 0 : 1);
