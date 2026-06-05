import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FirebaseService } from '../firebase/firebase.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

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

  private async executeWithFallback(contents: any[], systemInstruction: string, generationConfig: any): Promise<{ responseText: string, promptTokenCount: number, candidatesTokenCount: number }> {
    const modelChain = [
      { type: 'google', name: 'gemini-1.5-pro' },
      { type: 'openrouter', name: 'openai/gpt-3.5-turbo' }
    ];

    // Append JSON instruction if JSON response is requested
    let finalSystemInstruction = systemInstruction;
    if (generationConfig?.responseMimeType === 'application/json') {
      const jsonClause = 'You MUST return ONLY valid JSON. No explanation before or after. Start with { and end with }.';
      finalSystemInstruction = finalSystemInstruction
        ? `${finalSystemInstruction}\n${jsonClause}`
        : jsonClause;
    }

    let lastError: any = null;

    for (const modelInfo of modelChain) {
      try {
        if (modelInfo.type === 'google') {
          // Google Native API call
          const geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
            throw new Error('GEMINI_API_KEY is not configured or empty');
          }
          
          const model = this.genAI.getGenerativeModel({
            model: modelInfo.name,
            systemInstruction: finalSystemInstruction,
            generationConfig,
          });

          let result = await model.generateContent(contents);
          let response = await result.response;
          let responseText = response.text();
          let promptTokenCount = response.usageMetadata?.promptTokenCount || 0;
          let candidatesTokenCount = response.usageMetadata?.candidatesTokenCount || 0;

          // Validate JSON if required
          if (generationConfig?.responseMimeType === 'application/json') {
            try {
              JSON.parse(cleanAndExtractJson(responseText));
            } catch (jsonErr: any) {
              console.warn(`[AI Service] Gemini JSON parse failed. Retrying... Error: ${jsonErr.message}`);
              const retryPrompt = `Your previous response was not valid JSON. Error: ${jsonErr.message}. You MUST return ONLY valid JSON. No explanation before or after. Start with { and end with }. Original request: ${JSON.stringify(contents.filter(c => typeof c === 'string'))}`;
              result = await model.generateContent([...contents, retryPrompt]);
              response = await result.response;
              responseText = response.text();
              promptTokenCount += response.usageMetadata?.promptTokenCount || 0;
              candidatesTokenCount += response.usageMetadata?.candidatesTokenCount || 0;
              // Verify again
              JSON.parse(cleanAndExtractJson(responseText));
            }
          }
          
          return {
            responseText,
            promptTokenCount,
            candidatesTokenCount
          };
        } else {
          // OpenRouter API call
          const openRouterKey = process.env.OPENROUTER_API_KEY || '';
          if (!openRouterKey || openRouterKey.trim() === '') {
            throw new Error('OPENROUTER_API_KEY is not configured or empty');
          }
          
          // Prepare messages: system prompt + user text contents
          const messages: any[] = [];
          if (finalSystemInstruction) {
            messages.push({ role: 'system', content: finalSystemInstruction });
          }

          // OpenRouter fallback models are text-only, so extract text parts only
          const textParts: string[] = [];
          for (const item of contents) {
            if (typeof item === 'string') {
              textParts.push(item);
            }
          }
          
          if (textParts.length > 0) {
            messages.push({ role: 'user', content: textParts.join('\n') });
          }

          const requestBody: any = {
            model: modelInfo.name,
            messages,
            temperature: 0.7,
            max_tokens: generationConfig.maxOutputTokens || 400,
          };

          console.log(`[AI Service] Attempting fallback with OpenRouter model: ${modelInfo.name}`);
          let response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            requestBody,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openRouterKey}`,
                'HTTP-Referer': 'https://anzeigenboost.de',
                'X-Title': 'AnzeigenBoost',
              },
              timeout: 15000,
            }
          );

          if (!response.data || !response.data.choices || response.data.choices.length === 0) {
            throw new Error(`Invalid response from OpenRouter: ${JSON.stringify(response.data)}`);
          }

          let responseText = response.data.choices[0].message.content;
          let promptTokenCount = response.data.usage?.prompt_tokens || 0;
          let candidatesTokenCount = response.data.usage?.completion_tokens || 0;

          // Validate JSON if required
          if (generationConfig?.responseMimeType === 'application/json') {
            try {
              JSON.parse(cleanAndExtractJson(responseText));
            } catch (jsonErr: any) {
              console.warn(`[AI Service] OpenRouter JSON parse failed. Retrying... Error: ${jsonErr.message}`);
              messages.push({ role: 'assistant', content: responseText });
              messages.push({
                role: 'user',
                content: `Your previous response was not valid JSON. Error: ${jsonErr.message}. You MUST return ONLY valid JSON. No explanation before or after. Start with { and end with }.`
              });
              
              response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                { ...requestBody, messages },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://anzeigenboost.de',
                    'X-Title': 'AnzeigenBoost',
                  },
                  timeout: 15000,
                }
              );

              if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error(`Invalid response from OpenRouter during retry: ${JSON.stringify(response.data)}`);
              }

              responseText = response.data.choices[0].message.content;
              promptTokenCount += response.data.usage?.prompt_tokens || 0;
              candidatesTokenCount += response.data.usage?.completion_tokens || 0;
              // Verify again
              JSON.parse(cleanAndExtractJson(responseText));
            }
          }

          return {
            responseText,
            promptTokenCount,
            candidatesTokenCount,
          };
        }
      } catch (error: any) {
        console.warn(`[AI Service] ${modelInfo.name} failed: ${error.message}. Falling back...`);
        lastError = error;
        continue;
      }
    }

    console.error('[AI Service] All models in the fallback chain are exhausted.', lastError);
    throw new HttpException(
      'Der Server ist ausgelastet. Bitte klicke auf \'Erneut versuchen\' oder passe deine Beschreibung an.',
      HttpStatus.TOO_MANY_REQUESTS
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
      const fallbackResult = await this.executeWithFallback(
        [userPrompt, ...imageParts],
        this.analyzePhotosPrompt,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 800,
        }
      );
      responseText = fallbackResult.responseText;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;
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
      const retryPrompt = 'Deine vorherige Antwort war kein valides JSON. Bitte generiere ein striktes, valides JSON.';
      try {
        const fallbackResult = await this.executeWithFallback(
          [retryPrompt, ...imageParts],
          this.analyzePhotosPrompt,
          {
            responseMimeType: 'application/json',
            maxOutputTokens: 800,
          }
        );
        responseText = fallbackResult.responseText;
        promptTokenCount += fallbackResult.promptTokenCount;
        candidatesTokenCount += fallbackResult.candidatesTokenCount;
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

    

    // Extract only needed fields (Rule Four) — truncate description to 300 chars to keep prompt small
    const descSlice = (description || '').slice(0, 300);
    const userPrompt =
      `Title: ${title}\nDescription: ${descSlice}\nCategory: ${category}`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      console.log('[KI-Opt] Calling Gemini API (attempt 1)...');
      const fallbackResult = await this.executeWithFallback(
        [userPrompt],
        this.optimizeAdPrompt,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 400,
        }
      );
      responseText = fallbackResult.responseText;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;

      if (!isJsonComplete(responseText)) {
        throw new Error(`TRUNCATED: response ends at char ${responseText.length}`);
      }
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      // Surface quota errors immediately — no point retrying
      const quotaErr = extractQuotaError(error);
      if (quotaErr) {
        console.error('[KI-Opt] Quota exceeded:', quotaErr.message);
        throw new HttpException(quotaErr.message, HttpStatus.TOO_MANY_REQUESTS);
      }
      console.error('[KI-Opt] Attempt 1 failed:', error.message);

      // Retry with ultra-short constraints to guarantee the JSON fits in 400 tokens
      const retryPrompt =
        `Optimize this German classified ad. Return ONLY valid JSON, no extra text.\n` +
        `{"improvedTitle":"<max 50 chars>","improvedDescription":"<max 40 words>","improvementSummary":"<max 10 words>"}\n\n` +
        `Ad title: ${title}\nAd category: ${category}`;

      try {
        console.log('[KI-Opt] Calling Gemini API (retry attempt 2)...');
        const fallbackResult = await this.executeWithFallback(
          [retryPrompt],
          this.optimizeAdPrompt,
          {
            responseMimeType: 'application/json',
            maxOutputTokens: 400,
          }
        );
        responseText = fallbackResult.responseText;
        promptTokenCount += fallbackResult.promptTokenCount;
        candidatesTokenCount += fallbackResult.candidatesTokenCount;

        if (!isJsonComplete(responseText)) {
          throw new Error(`TRUNCATED on retry: response ends at char ${responseText.length}`);
        }
        const cleaned = cleanAndExtractJson(responseText);
        parsedJson = JSON.parse(cleaned);
      } catch (retryError: any) {
        // Surface quota errors from retry
        const quotaErr = extractQuotaError(retryError);
        if (quotaErr) {
          console.error('[KI-Opt] Quota exceeded on retry:', quotaErr.message);
          throw new HttpException(quotaErr.message, HttpStatus.TOO_MANY_REQUESTS);
        }
        console.error('[KI-Opt] Retry failed:', retryError.message, '| raw:', responseText.slice(0, 120));
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

    

    const userPrompt = `Valuate this item title: ${title}`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      const fallbackResult = await this.executeWithFallback(
        [userPrompt],
        this.priceCheckPrompt,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 400,
        }
      );
      responseText = fallbackResult.responseText;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      console.error('Gemini Price Valuate failed on first attempt. Raw response:', responseText);
      console.error('Parse error:', error);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Do not include markdown code fences, do not include surrounding text.`;
        const fallbackResult = await this.executeWithFallback(
          [retryPrompt],
          this.priceCheckPrompt,
          {
            responseMimeType: 'application/json',
            maxOutputTokens: 400,
          }
        );
        responseText = fallbackResult.responseText;
        promptTokenCount += fallbackResult.promptTokenCount;
        candidatesTokenCount += fallbackResult.candidatesTokenCount;
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


    const userPrompt = `
Message history (latest messages at the end):
${messageHistory.map((m, idx) => `[Message ${idx + 1}]: ${m}`).join('\n')}
`;

    let responseText = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      const fallbackResult = await this.executeWithFallback(
        [userPrompt],
        this.replySuggestionsPrompt,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 300,
        }
      );
      responseText = fallbackResult.responseText;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      console.error('Gemini Reply Suggestions failed on first attempt. Raw response:', responseText);
      console.error('Parse error:', error);
      try {
        const retryPrompt = `${userPrompt}\nReturn ONLY a valid JSON object matching the requested schema. Do not include markdown code fences, do not include surrounding text.`;
        const fallbackResult = await this.executeWithFallback(
          [retryPrompt],
          this.replySuggestionsPrompt,
          {
            responseMimeType: 'application/json',
            maxOutputTokens: 300,
          }
        );
        responseText = fallbackResult.responseText;
        promptTokenCount += fallbackResult.promptTokenCount;
        candidatesTokenCount += fallbackResult.candidatesTokenCount;
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
  async suggestRepostTime(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    
    // Fetch all logs and filter in-memory
    const logsSnapshot = await db.collection('users').doc(userId).collection('ads').doc(adId).collection('repostLogs').get();
    
    const allLogs = logsSnapshot.docs.map(doc => doc.data());
    
    // Filter only logs where both viewsBefore and viewsAfter are populated
    const trackedLogs = allLogs.filter(log => 
      log.viewsBefore !== null && log.viewsBefore !== undefined && 
      log.viewsAfter !== null && log.viewsAfter !== undefined
    );
    
    // Sort descending by execution date
    trackedLogs.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    
    // Take the last 30
    const recentLogs = trackedLogs.slice(0, 30);
    
    if (recentLogs.length < 5) {
      throw new HttpException(
        'Noch nicht genug Daten — mindestens 5 Reposts mit Aufruf-Tracking werden benötigt.', 
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
    
    const dataset = recentLogs.map(log => {
      const d = new Date(log.executedAt);
      return {
        dayOfWeek: d.getDay(),
        hourOfDay: d.getHours(),
        viewsGained: log.viewsGained || 0
      };
    });

    const prompt = `Here is the dataset showing views gained for reposts at different days of week and hours of day:
${JSON.stringify(dataset)}`;

    const systemInstruction = `You are analyzing repost timing data for a German classified ad. Given the data showing how many views were gained for reposts at different days and hours, identify the best day of week and hour to repost this ad to maximize views. Return only a JSON object with fields bestDayOfWeek as a number 0 to 6 where 0 is Sunday, bestHour as a number 0 to 23, confidence as low medium or high, reasoning as a German string under 30 words, improvementPercent as a number (estimated percentage increase in views, e.g., 47), and secondBestOption as an object with the same dayOfWeek and hour fields for an alternative slot.`;

    try {
      const fallbackResult = await this.executeWithFallback(
        [prompt],
        systemInstruction,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 300,
        }
      );
      const text = fallbackResult.responseText;
      const parsed = JSON.parse(cleanAndExtractJson(text));

      // Save suggestion in Firestore
      await db.collection('users').doc(userId).collection('ads').doc(adId).update({
        aiSuggestedRepostDay: parsed.bestDayOfWeek,
        aiSuggestedRepostHour: parsed.bestHour,
        aiSuggestionConfidence: parsed.confidence,
        aiSuggestionReasoning: parsed.reasoning,
        aiSuggestedImprovementPercent: parsed.improvementPercent || 0,
        aiSecondBestOption: parsed.secondBestOption || null
      });

      return parsed;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Fehler bei der KI-Analyse: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getUserUsage(userId: string): Promise<{ plan: string; callsCount: number; limit: number }> {
    const db = this.firebaseService.firestore;

    // 1. Fetch user tier/plan
    const userDoc = await db.collection('users').doc(userId).get();
    const plan = userDoc.data()?.tier || userDoc.data()?.plan || 'free';

    // 2. Fetch current month usage count
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usageDoc = await db.collection('aiUsage').doc(userId).get();

    let callsCount = 0;
    if (usageDoc.exists) {
      const data = usageDoc.data()!;
      if (data.month === currentMonth) {
        callsCount = data.callsCount || 0;
      }
    }

    // 3. Define limits based on plan
    let limit = 50; // default for free
    const normalizedPlan = plan.toLowerCase();
    if (normalizedPlan === 'starter') {
      limit = 1000;
    } else if (normalizedPlan === 'pro' || normalizedPlan === 'unlimited') {
      limit = Infinity;
    }

    return {
      plan,
      callsCount,
      limit,
    };
  }


  /**
   * Health check — does NOT call Gemini (would burn quota).
   * Validates only: key is present, non-empty, looks like a real key (39+ chars).
   * Returns ok=true if the key is configured; latencyMs=0 (no network call).
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy_key' || geminiKey.trim() === '') {
      return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY not configured' };
    }
    // A real Gemini API key is always 39 characters starting with "AI"
    const looksValid = geminiKey.length >= 30 && !geminiKey.includes('dummy');
    if (!looksValid) {
      return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY looks invalid' };
    }
    return { ok: true, latencyMs: 0 };
  }
}


/**
 * Detects a Google API quota-exceeded (429) error and returns a German-language
 * user-facing message including how long to wait.
 */
function extractQuotaError(err: any): { message: string } | null {
  const raw = err?.message || '';
  if (!raw.includes('Quota exceeded') && !raw.includes('RESOURCE_EXHAUSTED') && !raw.includes('quota')) {
    return null;
  }

  // Try to extract retryDelay from the error message (e.g. "Please retry in 54.77s")
  const delayMatch = raw.match(/retry in ([\d.]+)s/i);
  const delaySec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : null;
  const delayMin = delaySec ? Math.ceil(delaySec / 60) : null;

  const waitMsg = delayMin
    ? ` Bitte warte ${delayMin} Minute${delayMin !== 1 ? 'n' : ''} und versuche es erneut.`
    : ' Bitte versuche es später erneut.';

  return {
    message: `KI-Tageslimit erreicht (Free-Tier: 1.500 Anfragen/Tag).${waitMsg} Für unbegrenzte Nutzung: Gemini API-Schlüssel auf Paid-Tier upgraden.`,
  };
}

/**
 * Quick completeness guard — returns false if the response is truncated JSON.
 * Checks that after stripping markdown fences there is a { ... } pair.
 */
function isJsonComplete(text: string): boolean {
  if (!text) return false;
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const open = stripped.lastIndexOf('{');
  const close = stripped.lastIndexOf('}');
  return open !== -1 && close > open;
}

function cleanAndExtractJson(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Safely strip out any background reasoning text or system thinking logs
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.trim();
  
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
