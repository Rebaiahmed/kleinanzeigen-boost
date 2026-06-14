# Apify Scraper Data Quality Probe

Quick exploration script to test the Apify Kleinanzeigen scraper before building the price-suggestion feature.

## What it does

Calls the Apify Actor for 3 sample queries, saves raw JSON, and prints a data quality summary.

## Setup

1. **Get an Apify token** from https://apify.com (free tier has credits)
2. **Set the env var:**
   ```bash
   export APIFY_TOKEN=xxx
   ```

## Run it

```bash
cd scratch
node test-apify-scraper.js
```

## Output

For each query:
- **results-{query}.json** — raw items from the scraper
- **Console summary:**
  - Item count
  - Fields present
  - Price stats (min/median/max, parseability)
  - Relevance check

## What to look for

After running, ask yourself:

1. **Price data**: Are prices clean numbers or messy strings? ✓ or ✗
2. **Condition field**: Is there a `condition` field for comparability? ✓ or ✗
3. **Relevance**: Are results actually related to the query? ✓ or ✗
4. **Cost**: Check console for runtime; each call costs ~$0.01–$0.05

## Decision

- **All green?** → Wire the scraper into `price-suggestion.service.ts`
- **Red flags?** → Data needs cleanup, or feature is not viable

This is a **throwaway script** — delete after you've made a decision.
