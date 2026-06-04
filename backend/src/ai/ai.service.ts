import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FirebaseService } from '../firebase/firebase.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private analyzePhotosPrompt: string;
  private optimizeAdPrompt: string;
  private priceCheckPrompt: string;
  private replySuggestionsPrompt: string;

  constructor(private readonly firebaseService: FirebaseService) {
    // Setup Google Generative AI client
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

    // Load system prompts from files at module initialization (Rule Five)
    this.analyzePhotosPrompt = fs.readFileSync(
      path.join(__dirname, 'prompts/analyze-photos.system.txt'),
      'utf-8',
    );
    this.optimizeAdPrompt = fs.readFileSync(
      path.join(__dirname, 'prompts/optimize-ad.system.txt'),
      'utf-8',
    );
    this.priceCheckPrompt = fs.readFileSync(
      path.join(__dirname, 'prompts/price-check.system.txt'),
      'utf-8',
    );
    this.replySuggestionsPrompt = fs.readFileSync(
      path.join(__dirname, 'prompts/reply-suggestions.system.txt'),
      'utf-8',
    );
  }

  private async logUsage(userId: string, promptTokens: number, candidatesTokens: number) {
    try {
      const db = this.firebaseService.firestore;
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
        const data = usageDoc.data()!;
        if (data.month === currentMonth) {
          usageData = {
            callsCount: data.callsCount || 0,
            promptTokens: data.promptTokens || 0,
            candidatesTokens: data.candidatesTokens || 0,
            month: currentMonth,
          };
        }
      }

      usageData.callsCount += 1;
      usageData.promptTokens += promptTokens;
      usageData.candidatesTokens += candidatesTokens;

      await usageRef.set(usageData, { merge: true });
    } catch (err: any) {
      console.warn('Failed to log AI usage to Firestore:', err.message);
    }
  }

  async calculateScheduleInterval(intervalType: 'Täglich' | 'Alle 3 Tage' | 'Wöchentlich') {
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
      const data = usageDoc.data()!;
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
      model: 'gemini-2.5-flash', // Rule Seven
      systemInstruction: this.analyzePhotosPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 800, // Rule One
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

    // 5. Try to parse JSON output; retry once with more explicit prompt if parsing fails (Rule Two)
    let parsedJson: any = null;
    try {
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse Gemini response on first attempt. Raw response:', responseText);
      console.error('Parse error:', parseError);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Do not include markdown code fences, do not include surrounding text.`;
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

    // 6. Update usage in Firestore and increment monthly count (Rule Six)
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

  async optimizeExistingAd(userId: string, title: string, description: string, category: string) {
    console.log(`[KI-Opt] optimizeExistingAd START — userId: ${userId}, title: "${title?.slice(0, 40)}"`);
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      console.error('[KI-Opt] No GEMINI_API_KEY configured');
      throw new HttpException(
        'KI-Analysedienst nicht konfiguriert. Bitte trage einen gültigen GEMINI_API_KEY in der backend/.env Datei ein.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // Rule Seven
      systemInstruction: this.optimizeAdPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 600, // Rule One
      },
    });

    // Extract only needed fields (Rule Four)
    const userPrompt = `
Optimize the following listing:
Title: ${title}
Description: ${description}
Category: ${category}
`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      console.log('[KI-Opt] Calling Gemini API (attempt 1)...');
      const result = await model.generateContent([userPrompt]);
      const response = await result.response;
      responseText = response.text();
      console.log(`[KI-Opt] Gemini responded (attempt 1), raw length: ${responseText.length}`);
      promptTokenCount = response.usageMetadata?.promptTokenCount || 0;
      candidatesTokenCount = response.usageMetadata?.candidatesTokenCount || 0;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      console.error('[KI-Opt] Parse error (attempt 1):', error);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Make the description very brief and concise (under 80 words) to ensure it does not exceed output token limits. Do not include markdown code fences, do not include surrounding text.`;
        console.log('[KI-Opt] Calling Gemini API (retry attempt 2)...');
        const result = await model.generateContent([retryPrompt]);
        const response = await result.response;
        responseText = response.text();
        console.log(`[KI-Opt] Gemini responded (attempt 2), raw length: ${responseText.length}`);
        promptTokenCount += response.usageMetadata?.promptTokenCount || 0;
        candidatesTokenCount += response.usageMetadata?.candidatesTokenCount || 0;
        const cleaned = cleanAndExtractJson(responseText);
        parsedJson = JSON.parse(cleaned);
      } catch (retryError: any) {
        console.error('Gemini Ad Optimization retry failed. Raw response:', responseText);
        console.error('Retry parse error:', retryError);
        throw new HttpException(
          `Fehler bei der KI-Optimierung: Die Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Log Usage to Firestore (Rule Six)
    await this.logUsage(userId, promptTokenCount, candidatesTokenCount);

    return parsedJson;
  }

  async suggestPrice(userId: string, title: string) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      throw new HttpException(
        'KI-Analysedienst nicht konfiguriert. Bitte trage einen gültigen GEMINI_API_KEY in der backend/.env Datei ein.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // Rule Seven
      systemInstruction: this.priceCheckPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 400, // Rule One
      },
    });

    const userPrompt = `Valuate this item title: ${title}`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      const result = await model.generateContent([userPrompt]);
      const response = await result.response;
      responseText = response.text();
      promptTokenCount = response.usageMetadata?.promptTokenCount || 0;
      candidatesTokenCount = response.usageMetadata?.candidatesTokenCount || 0;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      console.error('Gemini Price Valuate failed on first attempt. Raw response:', responseText);
      console.error('Parse error:', error);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Do not include markdown code fences, do not include surrounding text.`;
        const result = await model.generateContent([retryPrompt]);
        const response = await result.response;
        responseText = response.text();
        promptTokenCount += response.usageMetadata?.promptTokenCount || 0;
        candidatesTokenCount += response.usageMetadata?.candidatesTokenCount || 0;
        const cleaned = cleanAndExtractJson(responseText);
        parsedJson = JSON.parse(cleaned);
      } catch (retryError: any) {
        console.error('Gemini Price Valuate retry failed. Raw response:', responseText);
        console.error('Retry parse error:', retryError);
        throw new HttpException(
          `Fehler bei der Preisanalyse: Die Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Log Usage to Firestore (Rule Six)
    await this.logUsage(userId, promptTokenCount, candidatesTokenCount);

    return { suggestedPrice: parsedJson.suggestedPrice, reasoning: parsedJson.reasoning };
  }

  async suggestReply(userId: string, messageHistory: string[]) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      throw new HttpException(
        'KI-Analysedienst nicht konfiguriert. Bitte trage einen gültigen GEMINI_API_KEY in der backend/.env Datei ein.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // Rule Seven
      systemInstruction: this.replySuggestionsPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 300, // Rule One
      },
    });

    const userPrompt = `
Message history (latest messages at the end):
${messageHistory.map((m, idx) => `[Message ${idx + 1}]: ${m}`).join('\n')}
`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      const result = await model.generateContent([userPrompt]);
      const response = await result.response;
      responseText = response.text();
      promptTokenCount = response.usageMetadata?.promptTokenCount || 0;
      candidatesTokenCount = response.usageMetadata?.candidatesTokenCount || 0;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      console.error('Gemini Reply Suggestions failed on first attempt. Raw response:', responseText);
      console.error('Parse error:', error);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Do not include markdown code fences, do not include surrounding text.`;
        const result = await model.generateContent([retryPrompt]);
        const response = await result.response;
        responseText = response.text();
        promptTokenCount += response.usageMetadata?.promptTokenCount || 0;
        candidatesTokenCount += response.usageMetadata?.candidatesTokenCount || 0;
        const cleaned = cleanAndExtractJson(responseText);
        parsedJson = JSON.parse(cleaned);
      } catch (retryError: any) {
        console.error('Gemini Reply Suggestions retry failed. Raw response:', responseText);
        console.error('Retry parse error:', retryError);
        throw new HttpException(
          `Fehler bei den Antwortvorschlägen: Die Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Log Usage to Firestore (Rule Six)
    await this.logUsage(userId, promptTokenCount, candidatesTokenCount);

    return parsedJson;
  }

  /**
   * Minimal Gemini connectivity check.
   * Called by GET /api/ai/health (no auth) to power the panel health indicator dot.
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY not configured' };
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 5 },
    });

    const start = Date.now();
    try {
      await model.generateContent(['ping']);
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
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
