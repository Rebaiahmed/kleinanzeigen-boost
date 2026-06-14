import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

interface Comparable {
  title: string;
  price: number;
  condition?: string;
  url?: string;
}

@Injectable()
export class PriceSuggestionService {
  private readonly logger = new Logger(PriceSuggestionService.name);

  // POC: mocked comparables (hardcoded realistic data)
  // TODO: replace with real getComparables(query) after LLM step is proven
  private mockComparables: Record<string, Comparable[]> = {
    'iphone 13': [
      { title: 'iPhone 13 128GB Schwarz', price: 650, condition: 'wie neu', url: 'https://kleinanzeigen.de' },
      { title: 'iPhone 13 256GB Blau', price: 700, condition: 'wie neu', url: 'https://kleinanzeigen.de' },
      { title: 'iPhone 13 128GB - Kratzer', price: 580, condition: 'gut', url: 'https://kleinanzeigen.de' },
      { title: 'iPhone 13 256GB Graphit', price: 680, condition: 'wie neu', url: 'https://kleinanzeigen.de' },
      { title: 'iPhone 12 64GB (nicht 13!)', price: 450, condition: 'wie neu', url: 'https://kleinanzeigen.de' },
    ],
  };

  async getComparables(query: string): Promise<Comparable[]> {
    // POC: return mocked data based on query keywords
    const key = query.toLowerCase().split(' ')[0];
    return this.mockComparables[key] || this.mockComparables['iphone 13']; // default fallback
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
      // 1. Get comparables
      const comparables = await this.getComparables(ad.title);
      this.logger.log(`[Price] Got ${comparables.length} comparables for "${ad.title}"`);

      // 2. Call LLM
      const prompt = `You are a pricing assistant for the German classifieds site Kleinanzeigen.
The user wants to price this item:
Title: ${ad.title}
Description: ${ad.description || 'keine'}
Condition: ${ad.condition || 'unbekannt'}

Here are current similar listings on Kleinanzeigen:
${JSON.stringify(comparables, null, 2)}

Tasks:
1. From the comparables, identify which are genuinely similar to the user's item (same type, similar condition).
2. Suggest a fair price RANGE (low–high in EUR).
3. Give ONE short sentence of reasoning.

Be honest about uncertainty. If comparables are too different or too few, say so and give a wide range.

Respond ONLY with valid JSON:
{
  "suggestedLow": <number>,
  "suggestedHigh": <number>,
  "confidence": "low" | "medium" | "high",
  "reasoning": "<one sentence>",
  "comparablesUsed": <number>
}`;

      const systemPrompt = 'You are a pricing expert for German classifieds. Return JSON only, no prose.';

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

      this.logger.log(`[Price] Suggestion: ${suggestion.suggestedLow}-${suggestion.suggestedHigh}€ (confidence: ${suggestion.confidence})`);
      return suggestion;
    } catch (err: any) {
      this.logger.error(`[Price] Error: ${err.message}`);
      throw new HttpException('Preis-Vorschlag fehlgeschlagen', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
