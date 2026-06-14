#!/usr/bin/env node

/**
 * Apify Kleinanzeigen Scraper — Data Quality Probe
 *
 * Goal: Call the scraper for 3 sample queries, inspect data quality,
 * judge if it's suitable for price-suggestion feature.
 *
 * Usage: APIFY_TOKEN=xxx node test-apify-scraper.js
 *
 * Outputs:
 * - results-{query}.json files (raw data)
 * - Console summary of price stats, fields, quality
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error('❌ APIFY_TOKEN env var not set. Set it and try again.');
  process.exit(1);
}

const ACTOR_ID = 'SwhBn0fFKKWBVaqyO'; // lexis-solutions/ebay-kleinanzeigen
const API_BASE = 'https://api.apify.com/v2';

const QUERIES = [
  'iPhone 13',
  'Holzbett 90x200',
  'Nike Schuhe Größe 42',
];

const MAX_ITEMS = 30;

/**
 * Call Apify Actor synchronously and get dataset items
 */
async function scrapeQuery(query) {
  return new Promise((resolve, reject) => {
    const input = {
      searchQuery: query,
      maxItems: MAX_ITEMS,
    };

    const url = `${API_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

    const postData = JSON.stringify(input);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    console.log(`\n📡 Calling Apify for: "${query}"`);
    const startTime = Date.now();

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        console.log(`✓ Response received in ${elapsed}ms`);

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const items = JSON.parse(data);
          resolve({ items, elapsed });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Parse price from string like "65 €", "65 € VB", etc.
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;

  // Extract first number sequence
  const match = String(priceStr).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  return isNaN(num) ? null : num;
}

/**
 * Analyze results
 */
function analyzeResults(items, query) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Query: "${query}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`Items returned: ${items.length} / ${MAX_ITEMS}`);

  if (items.length === 0) {
    console.log('⚠️  No items returned.');
    return;
  }

  // Inspect first item
  const sample = items[0];
  console.log(`\nFields on item[0]:`);
  console.log(`  ${Object.keys(sample).join(', ')}`);

  // Price analysis
  const prices = items
    .map((item) => parsePrice(item.price))
    .filter((p) => p !== null);

  console.log(`\nPrice data quality:`);
  console.log(`  Items with parseable numeric price: ${prices.length} / ${items.length}`);

  if (prices.length > 0) {
    prices.sort((a, b) => a - b);
    const median = prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

    console.log(`  Price range: €${prices[0]} — €${prices[prices.length - 1]}`);
    console.log(`  Median price: €${median.toFixed(2)}`);
  }

  const unparseable = items.filter((item) => parsePrice(item.price) === null);
  if (unparseable.length > 0) {
    console.log(`\n  Items with unparseable/missing price (${unparseable.length}):`);
    unparseable.slice(0, 3).forEach((item) => {
      console.log(`    - "${item.title}" (price: "${item.price}")`);
    });
    if (unparseable.length > 3) {
      console.log(`    ... and ${unparseable.length - 3} more`);
    }
  }

  // Check for useful fields
  console.log(`\nField availability:`);
  const hasCondition = items.some((item) => item.condition);
  const hasDescription = items.some((item) => item.description);
  const hasLocation = items.some((item) => item.location);

  console.log(`  condition field: ${hasCondition ? '✓ YES' : '✗ NO'}`);
  console.log(`  description field: ${hasDescription ? '✓ YES' : '✗ NO'}`);
  console.log(`  location field: ${hasLocation ? '✓ YES' : '✗ NO'}`);

  // Sample item (full)
  console.log(`\nSample item (first result):`);
  console.log(JSON.stringify(sample, null, 2).substring(0, 500) + '...');

  // Relevance check (naive)
  const queryWords = query.toLowerCase().split(/\s+/);
  const relevantItems = items.filter((item) => {
    const title = String(item.title).toLowerCase();
    return queryWords.some((word) => title.includes(word));
  });

  console.log(`\nRelevance check:`);
  console.log(`  Titles containing query keywords: ${relevantItems.length} / ${items.length}`);
  if (relevantItems.length < items.length * 0.5) {
    console.log(`  ⚠️  Low relevance — many results don't match the query`);
  }
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Apify Kleinanzeigen Scraper — Data Quality Test\n');
  console.log(`Actor ID: ${ACTOR_ID}`);
  console.log(`Max items per query: ${MAX_ITEMS}`);
  console.log(`Queries: ${QUERIES.join(', ')}`);

  for (const query of QUERIES) {
    try {
      const { items, elapsed } = await scrapeQuery(query);

      // Save JSON
      const filename = path.join(__dirname, `results-${query.replace(/\s+/g, '_')}.json`);
      fs.writeFileSync(filename, JSON.stringify(items, null, 2));
      console.log(`💾 Saved to: ${filename}`);

      // Analyze
      analyzeResults(items, query);

      // Delay between requests to be respectful
      if (query !== QUERIES[QUERIES.length - 1]) {
        console.log('\n⏳ Waiting before next query...');
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error(`❌ Error for "${query}": ${error.message}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('✅ Probe complete. Check results-*.json and summary above.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
