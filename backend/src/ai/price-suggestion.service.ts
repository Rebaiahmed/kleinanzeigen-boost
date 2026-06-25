import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as https from 'https';

interface Comparable {
  title: string;
  price: number;
  condition?: string;
  url?: string;
}

interface KlazAdResponse {
  ad_id: string;
  title: string;
  price: { amount: number; currency_code: string };
  created_at: string;
  details?: Record<string, string>;
  ad_url?: string;
}

@Injectable()
export class PriceSuggestionService {
  private readonly logger = new Logger(PriceSuggestionService.name);
  private readonly klazApiKey = process.env.KLAZ_API_KEY;
  private readonly klazApiBase = 'https://api.kleinanzeigen-agent.de/api/v2/kleinanzeigen/search';

  private fetchFromKlazApi(query: string): Promise<KlazAdResponse[]> {
    return new Promise((resolve, reject) => {
      const url = `${this.klazApiBase}?q=${encodeURIComponent(query)}`;

      const options = {
        hostname: 'api.kleinanzeigen-agent.de',
        path: `/api/v2/kleinanzeigen/search?q=${encodeURIComponent(query)}`,
        method: 'GET',
        headers: {
          'klaz_key': this.klazApiKey,
          'User-Agent': 'kleinzeigen-bot/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            this.logger.error(`[KLAZ API] HTTP ${res.statusCode}`);
            reject(new Error(`KLAZ API returned ${res.statusCode}`));
            return;
          }

          try {
            const json = JSON.parse(data);
            if (!json.success || !json.data?.ads) {
              reject(new Error('Invalid KLAZ response'));
              return;
            }
            resolve(json.data.ads);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async getComparables(query: string): Promise<Comparable[]> {
    if (!this.klazApiKey) {
      this.logger.warn('[Price] No KLAZ_API_KEY set, using fallback');
      return [];
    }

    try {
      this.logger.log(`[Price] Fetching comparables for: "${query}"`);
      const ads = await this.fetchFromKlazApi(query);

      // Filter to items with numeric prices and map to Comparable format
      const comparables: Comparable[] = ads
        .filter((ad) => ad.price && typeof ad.price.amount === 'number' && ad.price.amount > 0)
        .map((ad) => ({
          title: ad.title,
          price: ad.price.amount,
          condition: ad.details?.['Zustand'] || undefined,
          url: ad.ad_url,
        }));

      this.logger.log(`[Price] Got ${comparables.length} comparables from KLAZ (${ads.length} total)`);
      return comparables;
    } catch (err: any) {
      this.logger.error(`[Price] KLAZ fetch failed: ${err.message}`);
      return [];
    }
  }

  async suggestPrice(
    aiService: any,
    ad: any,
  ): Promise<{
    suggestedLow: number;
    suggestedHigh: number;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
    comparablesUsed: number;
  }> {
    try {
      // 1. Get comparables. Empty (e.g. no KLAZ_API_KEY) is NOT fatal — we fall
      //    back to an AI-only estimate from the item details below.
      const comparables = await this.getComparables(ad.title);
      this.logger.log(`[Price] Got ${comparables.length} comparables for "${ad.title}"`);

      const hasComparables = comparables.length > 0;

      // 2. Call LLM with filtering instructions (or an estimate when no comparables).
      const prompt = `You are a pricing assistant for the German classifieds site Kleinanzeigen.

USER'S ITEM:
Title: ${ad.title}
Description: ${ad.description || '(keine)'}
Condition: ${ad.condition || '(unbekannt)'}

${hasComparables
  ? `COMPARABLE LISTINGS (raw from Kleinanzeigen API):\n${JSON.stringify(comparables, null, 2)}`
  : `NO COMPARABLE LISTINGS ARE AVAILABLE. Estimate a realistic German second-hand price range for this item from your own knowledge of the title, description and condition. Set "confidence" to "low" and "comparablesUsed" to 0.`}

FILTER & ANALYZE:
1. Keep ONLY listings that are genuinely similar:
   - Same product type/model as the user's item
   - Similar condition (Wie Neu ≈ Sehr Gut ≈ Gut; don't mix with "Befriedigend")
   - Drop: accessories, parts, bundles, unrelated models, or items with missing/zero prices

2. From the filtered list, calculate:
   - Price range (min–max of valid comparables in EUR)
   - Confidence level:
     * HIGH: 15+ filtered comparables
     * MEDIUM: 8–14 filtered comparables
     * LOW: 1–7 filtered comparables

3. Provide ONE short sentence reasoning explaining the range.

If you filter to 0 items, set confidence to "low" and give a wide range (±30% of first listing).

Respond ONLY with valid JSON, no markdown or prose:
{
  "suggestedLow": <number>,
  "suggestedHigh": <number>,
  "confidence": "low" | "medium" | "high",
  "reasoning": "<one sentence in German>",
  "comparablesUsed": <number of filtered items>
}`;

      const systemPrompt = 'You are a pricing expert for German classifieds. Respond with JSON only.';

      const result = await aiService.executeWithFallback(
        [prompt],
        systemPrompt,
        { responseMimeType: 'application/json', maxOutputTokens: 300 },
        { timeoutMs: 30000 },
      );

      // 3. Parse response
      const jsonText = result.responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const suggestion = JSON.parse(jsonText);

      this.logger.log(`[Price] Suggestion: ${suggestion.suggestedLow}-${suggestion.suggestedHigh}€ (confidence: ${suggestion.confidence}, ${suggestion.comparablesUsed} comparables)`);
      return suggestion;
    } catch (err: any) {
      this.logger.error(`[Price] Error: ${err.message}`);
      throw new HttpException('Preis-Vorschlag fehlgeschlagen', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
