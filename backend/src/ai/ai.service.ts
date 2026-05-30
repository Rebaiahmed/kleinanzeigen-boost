import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    // Setup OpenAI client configured for Groq API using Llama3-8B
    this.openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || 'dummy_key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  private readonly systemPrompt = `Du bist ein Experte für deutsche Kleinanzeigen. Deine Aufgabe ist es, Nutzer beim Verkaufen zu unterstützen. Optimiere Titel (max 60 Zeichen) und Beschreibung für mehr Klicks. Analysiere den Preis. Antworte immer im JSON-Format: { "title": string, "description": string, "suggestedPrice": number, "reasoning": string }.`;

  async optimizeAd(title: string, description: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Optimiere diese Anzeige:\nTitel: ${title}\nBeschreibung: ${description}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) throw new Error('Empty response from AI');
      
      const parsed = JSON.parse(responseContent);
      return parsed;
    } catch (error: any) {
      throw new InternalServerErrorException(`AI Optimization failed: ${error.message}`);
    }
  }

  async suggestPrice(title: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Wie viel ist dieser Artikel ungefähr wert? Titel: ${title}. Antworte nur mit dem JSON Format.` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) throw new Error('Empty response from AI');
      
      const parsed = JSON.parse(responseContent);
      return { suggestedPrice: parsed.suggestedPrice, reasoning: parsed.reasoning };
    } catch (error: any) {
      throw new InternalServerErrorException(`AI Price Suggestion failed: ${error.message}`);
    }
  }

  async calculateScheduleInterval(intervalType: 'Täglich' | 'Alle 3 Tage' | 'Wöchentlich') {
    // Simple heuristic-based deterministic calculation, avoiding AI costs for simple math
    const now = new Date();
    switch (intervalType) {
      case 'Täglich':
        now.setDate(now.getDate() + 1);
        break;
      case 'Alle 3 Tage':
        now.setDate(now.getDate() + 3);
        break;
      case 'Wöchentlich':
        now.setDate(now.getDate() + 7);
        break;
      default:
        now.setDate(now.getDate() + 1);
    }
    return { nextRepostAt: now.toISOString() };
  }
}
