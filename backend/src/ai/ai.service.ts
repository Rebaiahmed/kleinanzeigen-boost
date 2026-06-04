import { Injectable, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FirebaseService } from '../firebase/firebase.service';
import * as fs from 'fs';
import * as path from 'path';
import { AI_CONFIG } from '../config/ai.constants';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private genAI: GoogleGenerativeAI;
  private systemPrompt: string;

  constructor(private readonly firebaseService: FirebaseService) {
    // Setup OpenAI client configured for xAI (Grok) API
    this.openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || 'dummy_key',
      baseURL: 'https://api.x.ai/v1',
    });

    // Setup Google Generative AI client
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

    // Load system prompt from file so it can be edited without touching TS source
    this.systemPrompt = fs.readFileSync(
      path.join(__dirname, 'prompts/marketplace.system.txt'),
      'utf-8',
    );
  }

  async optimizeAd(title: string, description: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Optimiere diese Anzeige:\nTitel: ${title}\nBeschreibung: ${description}` }
        ],
        response_format: { type: 'json_object' },
        temperature: AI_CONFIG.temperature,
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
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Wie viel ist dieser Artikel ungefähr wert? Titel: ${title}. Antworte nur mit dem JSON Format.` }
        ],
        response_format: { type: 'json_object' },
        temperature: AI_CONFIG.priceTemperature,
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

  async analyzePhotos(userId: string, files: any[], hint?: string) {
    const db = this.firebaseService.firestore;

    // 1. Fetch user tier from their user document
    const userDoc = await db.collection('users').doc(userId).get();
    const plan = userDoc.data()?.tier || userDoc.data()?.plan || 'free';

    // 2. Fetch current month usage
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageRef = db.collection('aiUsage').doc(userId);
    const usageDoc = await usageRef.get();

    let usageData = {
      callsCount: 0,
      promptTokens: 0,
      candidatesTokens: 0,
      month: currentMonth,
    };

    if (usageDoc.exists) {
      const data = usageDoc.data();
      if (data.month === currentMonth) {
        usageData = {
          callsCount: data.callsCount || 0,
          promptTokens: data.promptTokens || 0,
          candidatesTokens: data.candidatesTokens || 0,
          month: currentMonth,
        };
      }
    }

    // 3. Enforce plan rate limit
    let limit = 5;
    const normalizedPlan = plan.toLowerCase();
    if (normalizedPlan === 'starter') {
      limit = 30;
    } else if (normalizedPlan === 'pro' || normalizedPlan === 'unlimited') {
      limit = Infinity;
    }

    if (usageData.callsCount >= limit) {
      throw new HttpException(
        'Du hast dein monatliches Limit für KI-Analysen erreicht. Bitte führe ein Upgrade auf ein höheres Paket unter /settings durch.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 4. Pre-check API Key configuration
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      throw new HttpException(
        'KI-Analysedienst nicht konfiguriert. Bitte trage einen gültigen GEMINI_API_KEY in der backend/.env Datei ein.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: this.systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      },
    });

    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const userPrompt = hint ? `Optionaler Hinweis vom Verkäufer: ${hint}` : 'Analysiere das Produkt auf den Fotos.';

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;

    try {
      const result = await model.generateContent([userPrompt, ...imageParts]);
      const response = await result.response;
      responseText = response.text();
      promptTokenCount = response.usageMetadata?.promptTokenCount || 0;
      candidatesTokenCount = response.usageMetadata?.candidatesTokenCount || 0;
    } catch (error: any) {
      const errMsg = error.message || '';
      if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
        throw new HttpException(
          'Der konfigurierte GEMINI_API_KEY ist ungültig. Bitte überprüfe deinen API-Schlüssel in der backend/.env Datei.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(`Fehler bei der KI-Analyse: ${errMsg}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // 5. Try to parse JSON output; retry once if parsing fails
    let parsedJson: any = null;
    try {
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse Gemini response on first attempt. Raw response:', responseText);
      console.error('Parse error:', parseError);
      try {
        const retryPrompt = `${userPrompt}\nReturn only the JSON object, nothing else.`;
        const result = await model.generateContent([retryPrompt, ...imageParts]);
        const response = await result.response;
        responseText = response.text();
        promptTokenCount += response.usageMetadata?.promptTokenCount || 0;
        candidatesTokenCount += response.usageMetadata?.candidatesTokenCount || 0;
        const cleanedRetry = cleanAndExtractJson(responseText);
        parsedJson = JSON.parse(cleanedRetry);
      } catch (retryError) {
        console.error('Failed to parse Gemini response on second attempt. Raw response:', responseText);
        console.error('Retry parse error:', retryError);
        throw new HttpException(
          'Die KI-Antwort konnte nicht als valides JSON verarbeitet werden. Bitte lade die Seite neu und versuche es erneut.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 6. Update usage in Firestore and increment monthly count
    usageData.callsCount += 1;
    usageData.promptTokens += promptTokenCount;
    usageData.candidatesTokens += candidatesTokenCount;

    await usageRef.set(usageData);

    const remainingCallsThisMonth = limit === Infinity ? -1 : Math.max(0, limit - usageData.callsCount);

    return {
      ...parsedJson,
      remainingCallsThisMonth,
    };
  }
}

function cleanAndExtractJson(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Remove markdown code blocks if any
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  cleaned = cleaned.trim();

  // Find first/last matching braces/brackets to extract clean JSON if there is other text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && lastBrace !== -1) {
    if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    } else {
      startIdx = firstBrace;
      endIdx = lastBrace;
    }
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    startIdx = firstBracket;
    endIdx = lastBracket;
  }

  if (startIdx !== -1 && endIdx !== -1) {
    return cleaned.substring(startIdx, endIdx + 1);
  }

  return cleaned;
}
