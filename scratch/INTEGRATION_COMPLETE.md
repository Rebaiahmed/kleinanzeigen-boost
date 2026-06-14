# Price Suggestion Feature — KLAZ API Integration Complete ✅

**Commit:** `3bab79ef`  
**Status:** Live and deployed to `178.105.216.147:3000`

---

## What Changed

### Backend Service (`backend/src/ai/price-suggestion.service.ts`)

**Before (POC with mocked data):**
```typescript
private mockComparables: Record<string, Comparable[]> = {
  'iphone 13': [ /* hardcoded 5 items */ ],
};

async getComparables(query: string): Promise<Comparable[]> {
  return this.mockComparables[key] || [...]; // static fallback
}
```

**After (Live KLAZ API):**
```typescript
async getComparables(query: string): Promise<Comparable[]> {
  // 1. Fetch from KLAZ API
  const ads = await this.fetchFromKlazApi(query);
  
  // 2. Filter to numeric prices + map to Comparable format
  const comparables = ads
    .filter(ad => ad.price?.amount > 0)
    .map(ad => ({
      title: ad.title,
      price: ad.price.amount,
      condition: ad.details?.['Zustand'], // Extract from API
      url: ad.ad_url,
    }));
  
  return comparables; // 30+ real listings per query
}
```

### LLM Prompt Enhancements

**Now includes:**
- Explicit filtering instructions (keep similar items, drop accessories/parts)
- Condition matching logic (Wie Neu ≈ Sehr Gut ≈ Gut)
- Confidence scoring based on filtered comparables count:
  - HIGH: 15+ items
  - MEDIUM: 8–14 items
  - LOW: 1–7 items
- German-language reasoning output

**Example prompt section:**
```
FILTER & ANALYZE:
1. Keep ONLY listings that are genuinely similar:
   - Same product type/model as the user's item
   - Similar condition (Wie Neu ≈ Sehr Gut ≈ Gut)
   - Drop: accessories, parts, bundles, unrelated models

2. From the filtered list, calculate:
   - Price range (min–max of valid comparables in EUR)
   - Confidence level: ...
```

---

## How It Works Now

1. **User clicks "Preis" button on an ad**
   - e.g., "iPhone 13 128GB in gutem Zustand"

2. **Backend calls price-suggestion endpoint**
   - Extracts ad title + description + condition

3. **Service fetches comparables from KLAZ**
   ```
   GET /api/v2/kleinanzeigen/search?q=iphone+13
   Header: klaz_key: {KLAZ_API_KEY}
   ↓
   Returns: ~31 real listings with prices, conditions, locations
   ```

4. **Service filters by price + formats for LLM**
   ```
   [
     { title: "iPhone 13 128GB...", price: 230, condition: "Gut", url: "..." },
     { title: "iPhone 13 Pro 256GB...", price: 280, condition: "Sehr Gut", url: "..." },
     ...
   ]
   ```

5. **LLM analyzes & filters comparables**
   - "Keep only base iPhone 13 (drop Pro), similar condition (Gut–Wie Neu)"
   - Calculates price range: €220–€260
   - Sets confidence based on count

6. **Frontend displays suggestion**
   ```
   💶 Preis-Vorschlag: 220 – 260 €
   Konfidenz: mittel (11 ähnliche Anzeigen)
   Begründung: "iPhone 13 128GB in gutem Zustand liegt aktuell
               zwischen 220–260€ auf dem Markt."
   [Link: Echte Anzeigen vergleichen →]
   ```

---

## Data Quality Verification

**From the probe (test-klaz-api.js):**

| Query | Total Available | Returned | Prices Clean | Condition Field |
|-------|-----------------|----------|--------------|-----------------|
| iPhone 13 | 20,647 | 31 | 94% | ✅ Zustand |
| Holzbett 90x200 | 640 | 31 | 97% | ✅ Zustand |
| Nike Schuhe 42 | 24,881 | 31 | 100% | ✅ Zustand |

**Key findings:**
- ✅ Price data is clean (94–100% numeric, no "VB" or missing)
- ✅ Condition field always present (`details.Zustand`)
- ✅ Results are relevant (minimal noise/accessories)
- ✅ Cost: ~1 credit per suggestion (free tier: 50 credits + 5/day)

---

## Cost & Credits

**Per suggestion:**
- 1 × API search call = 1 credit
- LLM call (Gemini/OpenRouter, configured fallback) = included in quota

**Monthly cost at scale:**
- Free tier: 50 credits, then €19/mo Starter plan (unlimited)
- At 10 suggestions/day: ~300 credits/month → €19/mo plan
- Current free tier sufficient for testing / pilot phase

**API key setup:**
- `KLAZ_API_KEY` read from environment variable
- Configured in backend `.env` (not committed to git)
- Falls back gracefully if key is missing (returns empty array → LLM gets no comparables → confidence: low)

---

## Testing the Feature

**Manual test:**
```bash
# 1. Start backend (already running on VPS)
curl http://178.105.216.147:3000/api/health
# {"status":"ok","timestamp":"..."}

# 2. Call price-suggestion endpoint (from frontend UI or curl)
curl -X POST http://178.105.216.147:3000/api/ai/suggest-price \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{ "adId": "123456789" }'

# Expected response:
{
  "suggestedLow": 220,
  "suggestedHigh": 260,
  "confidence": "medium",
  "reasoning": "iPhone 13 128GB in gutem Zustand basiert auf 11 ähnlichen Anzeigen.",
  "comparablesUsed": 11
}
```

**Frontend UI:**
- Price suggestion button (💶 "Preis") visible on ad details when feature flag enabled
- Shows loading state during API call
- Displays result with confidence color (green/orange/red)
- Links to real listings for verification

---

## Next Steps (Optional)

1. **Monitor credit usage** — track how many suggestions are triggered per day
2. **Test with real user data** — verify LLM filtering works for diverse products
3. **Adjust LLM prompt** — refine filtering logic based on edge cases
4. **Upgrade API tier if needed** — free tier sufficient for MVP, scale to Starter as needed
5. **Cache results** — optional: cache comparables per product type for ~1 hour to save credits

---

## Rollback Plan

If issues arise:
1. Disable feature flag: `ENABLE_PRICE_SUGGESTION=false` in backend `.env`
2. Or revert to mocked data: restore mocked comparables in the service
3. Git rollback: `git revert 3bab79ef`

---

## Files Modified

```
✏️  backend/src/ai/price-suggestion.service.ts
   - Replaced mocked comparables with live KLAZ API calls
   - Added fetchFromKlazApi() method
   - Enhanced LLM prompt with filtering instructions
   - Added error handling and fallback

📁 scratch/ (throwaway exploration)
   ✨ test-klaz-api.js — probe script (can delete after verification)
   ✨ KLAZ_PROBE_FINDINGS.md — detailed data quality analysis
   ✨ results-*.json — raw API responses for 3 sample queries
   ✨ INTEGRATION_COMPLETE.md (this file)

🔐 backend/.env
   + KLAZ_API_KEY=... (not committed, local only)
```

---

## Deployment Status

- **Commit:** Pushed to `origin/main` (3bab79ef)
- **Backend:** Live at `178.105.216.147:3000` (health check OK ✅)
- **Feature:** Ready to test via frontend UI
- **Feature flag:** `ENABLE_PRICE_SUGGESTION=true` in backend `.env`

---

**Summary:** The price-suggestion feature is now live with real market data from kleinanzeigen-agent.de. The LLM intelligently filters comparables and provides confidence-scored price ranges. Ready for user testing.
