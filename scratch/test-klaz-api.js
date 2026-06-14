#!/usr/bin/env node

/**
 * kleinanzeigen-agent.de API Data Quality Probe
 *
 * Tests 3 sample queries to evaluate data quality before integrating into price-suggestion feature.
 * Requires: KLAZ_API_KEY environment variable
 * Usage: KLAZ_API_KEY=xxx node test-klaz-api.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.KLAZ_API_KEY;
if (!API_KEY) {
  console.error('❌ Error: KLAZ_API_KEY environment variable not set');
  console.error('Usage: KLAZ_API_KEY=xxx node test-klaz-api.js');
  process.exit(1);
}

const API_BASE = 'api.kleinanzeigen-agent.de';
const API_ENDPOINT = '/api/v2/kleinanzeigen/search';

let totalCallsMade = 0;

function makeRequest(query, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams({
      q: query,
      ...params,
    }).toString();

    const url = `${API_ENDPOINT}?${queryString}`;

    const options = {
      hostname: API_BASE,
      path: url,
      method: 'GET',
      headers: {
        'klaz_key': API_KEY,
        'User-Agent': 'Mozilla/5.0',
      },
    };

    console.log(`\n📡 Calling: GET https://${API_BASE}${url.substring(0, 80)}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        totalCallsMade++;

        if (res.statusCode !== 200) {
          console.error(`❌ HTTP ${res.statusCode}: ${data.substring(0, 200)}`);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        try {
          const json = JSON.parse(data);

          // Log rate limit / credit info if present in headers
          if (res.headers['x-remaining-credits']) {
            console.log(`   💳 Remaining credits: ${res.headers['x-remaining-credits']}`);
          }
          if (res.headers['x-ratelimit-remaining']) {
            console.log(`   ⏱️  Rate limit remaining: ${res.headers['x-ratelimit-remaining']}`);
          }

          resolve(json);
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function analyzeResults(query, responseData) {
  const { success, data } = responseData;

  if (!success) {
    console.error(`❌ API returned success: false`);
    return;
  }

  const { meta, ads } = data;
  console.log(`\n✅ Query: "${query}"`);
  console.log(`   Total reported: ${meta.total} | Returned: ${ads.length} (page ${meta.page}, size ${meta.size})`);
  console.log(`   Source: ${meta.source}`);

  // Field analysis
  if (ads.length > 0) {
    const fieldsInFirst = Object.keys(ads[0]).sort();
    console.log(`\n   Fields present on ads[0]: ${fieldsInFirst.join(', ')}`);
  }

  // Price analysis
  const adsWithPrice = ads.filter(ad =>
    ad.price && typeof ad.price.amount === 'number' && ad.price.amount > 0
  );
  const adsNoPriceOrZero = ads.filter(ad =>
    !ad.price || typeof ad.price.amount !== 'number' || ad.price.amount === 0
  );

  console.log(`\n   Price check:`);
  console.log(`     ✓ Ads with numeric price.amount: ${adsWithPrice.length} / ${ads.length}`);

  if (adsNoPriceOrZero.length > 0) {
    console.log(`     ✗ Ads with NO/zero/missing price: ${adsNoPriceOrZero.length}`);
    adsNoPriceOrZero.slice(0, 3).forEach(ad => {
      console.log(`       - "${ad.title}" (price: ${ad.price?.amount || 'missing'})`);
    });
  }

  if (adsWithPrice.length > 0) {
    const prices = adsWithPrice.map(ad => ad.price.amount).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const median = prices[Math.floor(prices.length / 2)];
    const currency = adsWithPrice[0].price.currency_code || 'EUR';

    console.log(`     Price range: ${min} / ${median} / ${max} ${currency}`);
  }

  // Relevance check
  console.log(`\n   Relevance check (first 10 titles + prices):`);
  ads.slice(0, 10).forEach((ad, i) => {
    const price = ad.price?.amount ? `${ad.price.amount} EUR` : 'N/A';
    console.log(`     ${i + 1}. "${ad.title}" – ${price}`);
  });

  if (ads.length > 10) {
    console.log(`     ... and ${ads.length - 10} more`);
  }

  // Sample ad
  if (ads.length > 0) {
    console.log(`\n   Sample ad (full JSON):`);
    console.log(`     ${JSON.stringify(ads[0], null, 2).split('\n').map(l => '     ' + l).join('\n')}`);
  }

  // Additional observations
  console.log(`\n   Notes:`);
  if (adsWithPrice.length === ads.length) {
    console.log(`     ✓ All ads have clean numeric prices`);
  } else {
    console.log(`     ⚠ ${ads.length - adsWithPrice.length} ads missing prices (need filtering)`);
  }

  if (ads.length > 0 && ads[0].condition) {
    console.log(`     ✓ Condition field present on ads`);
  } else {
    console.log(`     ⚠ No condition field in search results (may need +1 credit per ad detail call)`);
  }

  if (ads.length > 0 && ads[0].description) {
    console.log(`     ✓ Description field present`);
  } else {
    console.log(`     ⚠ No description field in search results`);
  }

  if (meta.total > meta.size) {
    console.log(`     ℹ Pagination available: ${meta.total} total, only got ${meta.size} on page 0`);
  }

  return ads;
}

async function main() {
  try {
    console.log('🔍 kleinanzeigen-agent.de API Quality Probe');
    console.log('==========================================\n');

    // Step 1: Smoke test with cheapest query
    console.log('Step 1: Smoke test (verify auth + endpoint)');
    const smokeTest = await makeRequest('iphone', { distance: 25 });
    if (!smokeTest.success) {
      console.error('❌ Smoke test failed. Check API key and endpoint.');
      process.exit(1);
    }
    console.log('✅ Smoke test passed. Auth and endpoint OK.');

    // Step 2: Run 3 sample queries
    console.log('\n\nStep 2: Sample queries\n');

    const queries = [
      { q: 'iphone 13', params: {} },
      { q: 'holzbett 90x200', params: {} },
      { q: 'nike schuhe 42', params: {} },
    ];

    const results = {};

    for (const { q, params } of queries) {
      try {
        const response = await makeRequest(q, params);
        analyzeResults(q, response);

        // Save raw JSON
        const filename = `results-${q.replace(/\s+/g, '_')}.json`;
        const filepath = path.join(__dirname, filename);
        fs.writeFileSync(filepath, JSON.stringify(response, null, 2));
        console.log(`\n   💾 Saved to: ${filepath}`);

        results[q] = response;
      } catch (e) {
        console.error(`\n❌ Query "${q}" failed:`, e.message);
      }
    }

    // Summary
    console.log('\n\n📊 Summary\n');
    console.log(`Total API calls made: ${totalCallsMade}`);
    console.log(`(Free tier: 50 credits + 5/day, ~1 credit per search)`);
    console.log(`Estimated remaining credits: ~${50 - totalCallsMade}`);

    console.log('\n✅ Probe complete. Review summaries above and results-*.json files.');
    console.log('\n📋 Next steps:');
    console.log('   1. Review price data cleanliness (numeric, no outliers)');
    console.log('   2. Check if condition/description fields are available (determine detail call cost)');
    console.log('   3. Evaluate relevance (are results genuinely comparable or noisy)');
    console.log('   4. If promising: wire into price-suggestion.service.ts');

  } catch (e) {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
  }
}

main();
