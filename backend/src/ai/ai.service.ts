import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FirebaseService } from '../firebase/firebase.service';
import { getEffectiveLimit, estimateCostUsd } from '../config/ai-limits.constants';
import { AI_CONFIG } from '../config/ai.constants';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private analyzePhotosPrompt: string;
  private optimizeAdPrompt: string;
  private priceCheckPrompt: string;

  constructor(private readonly firebaseService: FirebaseService) {
    // Construct the Gemini client only when a key is actually configured.
    // If absent, genAI stays null and the model fallback chain skips Gemini and
    // uses OpenRouter. (App-level startup validation already fails fast when
    // NEITHER provider key is set — see main.ts validateEnv.)
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    this.genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

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
  }

  /** Throws only if NO AI provider is configured. Either Gemini or OpenRouter
   *  is sufficient — the model fallback chain uses whichever key(s) exist. */
  private assertAiConfigured() {
    const hasGemini = !!process.env.GEMINI_API_KEY?.trim();
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY?.trim();
    if (!hasGemini && !hasOpenRouter) {
      throw new HttpException(
        'KI-Dienst nicht konfiguriert. Bitte trage GEMINI_API_KEY oder OPENROUTER_API_KEY in der backend/.env Datei ein.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async executeWithFallback(
    contents: any[],
    systemInstruction: string,
    generationConfig: any,
    options: { timeoutMs?: number } = {},
  ): Promise<{ responseText: string, promptTokenCount: number, candidatesTokenCount: number, modelName: string }> {
    // Free-first: $0 models are tried before any paid model. Free tiers have tight
    // rate limits, so under load we fall through to paid — that reduces cost, not
    // eliminates it. `vision` marks models that accept image input; text-only models
    // are filtered out when the request contains images (see hasImages below).
    // Paid-first. The free ($0) models (gemini-2.0-flash free tier, *:free on
    // OpenRouter) are perpetually rate-limited (429), so trying them first only
    // added 1–2s of wasted latency before falling through to a paid model. We lead
    // with the cheap, reliable paid model so a normal request is a single call.
    // (Gemini-native entries are dropped automatically when AI_DISABLE_GEMINI=true
    // or no GEMINI_API_KEY — see providerChain below.)
    const fullModelChain = [
      { type: 'openrouter', name: 'google/gemini-2.5-flash-lite', vision: true },  // ~$0.10/$0.40, reliable German + vision
      { type: 'openrouter', name: 'openai/gpt-4o-mini', vision: true },            // vision fallback
      { type: 'openrouter', name: 'qwen/qwen3-235b-a22b-2507', vision: false },    // ~$0.09/$0.10, strong cheap text
      { type: 'openrouter', name: 'x-ai/grok-3-mini', vision: false },
      { type: 'openrouter', name: 'deepseek/deepseek-chat', vision: false },
    ];

    // Drop Gemini (Google-native) models from the chain when there's no Gemini key
    // or when explicitly running OpenRouter-only (AI_DISABLE_GEMINI=true). This
    // avoids wasted attempts + noisy 429/exhausted logs when Gemini's free quota
    // is unusable and OpenRouter is the intended provider.
    const geminiDisabled =
      !process.env.GEMINI_API_KEY?.trim() || process.env.AI_DISABLE_GEMINI === 'true';
    const providerChain = geminiDisabled
      ? fullModelChain.filter((m) => m.type !== 'google')
      : fullModelChain;

    // Detect image input: image parts are objects with inlineData/image_url, not strings.
    const hasImages = contents.some(
      (c) => c && typeof c === 'object' && (c.inlineData || c.image_url || c.type === 'image_url'),
    );
    const modelChain = hasImages ? providerChain.filter((m) => m.vision) : providerChain;
    if (hasImages) {
      this.logger.log(`[AI Service] Image input detected — using vision models only: ${modelChain.map(m => m.name).join(', ')}`);
    }

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
          if (!geminiKey || geminiKey.trim() === '' || !this.genAI) {
            throw new Error('GEMINI_API_KEY is not configured or empty');
          }

          const model = this.genAI.getGenerativeModel(
            {
              model: modelInfo.name,
              systemInstruction: finalSystemInstruction,
              generationConfig,
            },
            // requestOptions — the SDK aborts the request after `timeout` ms.
            // (timeout belongs here, NOT in generationConfig, where it's ignored.)
            { timeout: options.timeoutMs || AI_CONFIG.geminiTimeoutMs },
          );

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
              this.logger.warn(`[AI Service] Gemini JSON parse failed. Retrying... Error: ${jsonErr.message}`);
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
            candidatesTokenCount,
            modelName: modelInfo.name,
          };
        } else {
          // OpenRouter API call
          const openRouterKey = process.env.OPENROUTER_API_KEY || '';
          if (!openRouterKey || openRouterKey.trim() === '') {
            throw new Error('OPENROUTER_API_KEY is not configured or empty');
          }
          
          // Prepare messages: system prompt + user contents (text + images)
          const messages: any[] = [];
          if (finalSystemInstruction) {
            messages.push({ role: 'system', content: finalSystemInstruction });
          }

          // Build multimodal content array for OpenRouter (supports vision models)
          const userContent: any[] = [];
          for (const item of contents) {
            if (typeof item === 'string') {
              userContent.push({ type: 'text', text: item });
            } else if (item?.inlineData?.data && item?.inlineData?.mimeType) {
              // Convert Gemini inlineData format → OpenRouter image_url format
              userContent.push({
                type: 'image_url',
                image_url: {
                  url: `data:${item.inlineData.mimeType};base64,${item.inlineData.data}`,
                },
              });
            }
          }

          if (userContent.length > 0) {
            messages.push({ role: 'user', content: userContent });
          }

          const requestBody: any = {
            model: modelInfo.name,
            messages,
            temperature: 0.7,
            max_tokens: generationConfig.maxOutputTokens || 400,
          };

          this.logger.log(`[AI Service] Attempting fallback with OpenRouter model: ${modelInfo.name}`);
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
              timeout: options.timeoutMs || AI_CONFIG.openRouterTimeoutMs,
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
              this.logger.warn(`[AI Service] OpenRouter JSON parse failed. Retrying... Error: ${jsonErr.message}`);
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
                  timeout: options.timeoutMs || AI_CONFIG.openRouterTimeoutMs,
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
            modelName: modelInfo.name,
          };
        }
      } catch (error: any) {
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('deadline');
        const logMsg = isTimeout
          ? `[AI Service] ${modelInfo.name} timeout (${options.timeoutMs || AI_CONFIG.openRouterTimeoutMs}ms exceeded). Falling back...`
          : `[AI Service] ${modelInfo.name} failed: ${error.message}. Falling back...`;
        this.logger.warn(logMsg);
        lastError = error;
        continue;
      }
    }

    this.logger.error('[AI Service] All models in the fallback chain are exhausted.', lastError);

    // Distinguish timeout from hard failure
    const isTimeout = lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout') || lastError?.message?.includes('deadline');

    throw new HttpException(
      {
        message: isTimeout
          ? 'KI-Analyse dauert länger als erwartet. Bitte versuche es in wenigen Minuten erneut.'
          : 'Alle KI-Anbieter sind momentan ausgelastet. Bitte versuche es in wenigen Minuten erneut.',
        code: isTimeout ? 'AI_TIMEOUT' : 'ALL_PROVIDERS_BUSY',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  /**
   * Records one AI call's usage. `metered` controls whether it counts toward the
   * plan limit — only photo analysis is metered today; cheap text ops are tracked
   * (tokens/model/cost/lastActive) for the admin view but don't consume the limit.
   * Resets the monthly fields when the stored month rolls over.
   */
  private async logUsage(
    userId: string,
    modelName: string,
    promptTokens: number,
    candidatesTokens: number,
    metered: boolean,
  ) {
    try {
      const db = this.firebaseService.firestore;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const usageRef = db.collection('aiUsage').doc(userId);
      const usageDoc = await usageRef.get();

      const stored = usageDoc.exists ? usageDoc.data()! : {};
      const sameMonth = stored.month === currentMonth;

      const base = sameMonth ? stored : {};
      const byModel = { ...(base.byModel || {}) };
      const m = byModel[modelName] || { calls: 0, promptTokens: 0, candidatesTokens: 0 };
      m.calls += 1;
      m.promptTokens += promptTokens;
      m.candidatesTokens += candidatesTokens;
      byModel[modelName] = m;

      const usageData = {
        month: currentMonth,
        // Count ALL AI calls (metered + unmetered) for dashboard display
        // The 'metered' flag only controls whether it counts toward the plan limit
        callsCount: (sameMonth ? base.callsCount || 0 : 0) + 1,
        promptTokens: (sameMonth ? base.promptTokens || 0 : 0) + promptTokens,
        candidatesTokens: (sameMonth ? base.candidatesTokens || 0 : 0) + candidatesTokens,
        estimatedCostUsd: (sameMonth ? base.estimatedCostUsd || 0 : 0) + estimateCostUsd(modelName, promptTokens, candidatesTokens),
        byModel,
        lastCallAt: now.toISOString(),
      };

      await usageRef.set(usageData, { merge: true });
    } catch (err: any) {
      this.logger.warn('Failed to log AI usage to Firestore:', err.message);
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

  async analyzePhotos(userId: string, files: any[], hint?: string, language?: string) {
    const db = this.firebaseService.firestore;

    // 1. Fetch user tier + per-user bonus from their user document
    const userDoc = await db.collection('users').doc(userId).get();
    const plan = userDoc.data()?.tier || userDoc.data()?.plan || 'free';
    const bonus = userDoc.data()?.aiLimitBonus || 0;

    // 2. Fetch current month's metered call count
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageRef = db.collection('aiUsage').doc(userId);
    const usageDoc = await usageRef.get();

    let callsCount = 0;
    if (usageDoc.exists) {
      const data = usageDoc.data()!;
      if (data.month === currentMonth) callsCount = data.callsCount || 0;
    }

    // 3. Enforce effective limit (plan + per-user bonus). Only photo analysis is metered.
    const limit = getEffectiveLimit(plan, bonus);

    if (callsCount >= limit) {
      throw new HttpException(
        {
          message: 'Du hast dein monatliches Limit für KI-Analysen erreicht. Bitte führe ein Upgrade auf ein höheres Paket unter /settings durch.',
          code: 'PLAN_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 4. Pre-check API Key configuration
    this.assertAiConfigured();

    const imageParts = files.map((file) => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const langInstruction = (language || 'de').toLowerCase().startsWith('en')
      ? 'OUTPUT LANGUAGE — THIS OVERRIDES ANY LANGUAGE MENTIONED ABOVE: Write title, description, keyFeatures and vinted.title, vinted.description in ENGLISH, even though the seller and platform are German. Keep the "category" value as the exact German Kleinanzeigen category name from the allowed list, and keep both condition fields as the exact allowed enum values (do NOT translate category or condition).'
      : 'OUTPUT LANGUAGE: Schreibe title, description, keyFeatures sowie vinted.title und vinted.description auf Deutsch.';

    // The base system prompt is written for German output, so the language choice
    // must be appended as the LAST, authoritative instruction (and repeated in the
    // user prompt) — otherwise the model ignores the flag and always returns German.
    const systemInstruction = `${this.analyzePhotosPrompt}\n\n${langInstruction}`;
    const userPrompt = `${langInstruction}\n${hint ? `Optionaler Hinweis vom Verkäufer: ${hint}` : 'Analysiere das Produkt auf den Fotos.'}`;

    let responseText = '';
    let modelUsed = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;

    try {
      const fallbackResult = await this.executeWithFallback(
        [userPrompt, ...imageParts],
        systemInstruction,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 1100,
        },
        { timeoutMs: AI_CONFIG.imageAnalysisTimeoutMs }
      );
      responseText = fallbackResult.responseText;
      modelUsed = fallbackResult.modelName;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
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
      this.logger.error('Failed to parse Gemini response on first attempt. Raw response:', responseText);
      this.logger.error('Parse error:', parseError);
      const retryPrompt = `${langInstruction}\nDeine vorherige Antwort war kein valides JSON. Bitte generiere ein striktes, valides JSON.`;
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
        this.logger.error('Failed to parse Gemini response on second attempt. Raw response:', responseText);
        this.logger.error('Retry parse error:', retryError);
        throw new HttpException(
          'Die KI-Antwort konnte nicht als valides JSON verarbeitet werden. Bitte lade die Seite neu und versuche es erneut.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 6. Record usage — metered (counts toward the limit) + model/cost/lastActive tracking
    await this.logUsage(userId, modelUsed, promptTokenCount, candidatesTokenCount, true);

    const remainingCallsThisMonth = limit === Infinity ? -1 : Math.max(0, limit - (callsCount + 1));

    return {
      ...parsedJson,
      remainingCallsThisMonth,
    };
  }

  async optimizeExistingAd(userId: string, title: string, description: string, category: string) {
    this.logger.log(`[KI-Opt] optimizeExistingAd START — userId: ${userId}, title: "${title?.slice(0, 40)}"`);
    this.assertAiConfigured();

    

    // Extract only needed fields (Rule Four) — truncate description to 300 chars to keep prompt small
    const descSlice = (description || '').slice(0, 300);
    const userPrompt =
      `Title: ${title}\nDescription: ${descSlice}\nCategory: ${category}`;

    let responseText = '';
    let modelUsed = '';
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let parsedJson: any = null;

    try {
      this.logger.log('[KI-Opt] Calling Gemini API (attempt 1)...');
      const fallbackResult = await this.executeWithFallback(
        [userPrompt],
        this.optimizeAdPrompt,
        {
          responseMimeType: 'application/json',
          maxOutputTokens: 400,
        }
      );
      responseText = fallbackResult.responseText;
      modelUsed = fallbackResult.modelName;
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
        this.logger.error('[KI-Opt] Quota exceeded:', quotaErr.message);
        throw new HttpException(quotaErr.message, HttpStatus.TOO_MANY_REQUESTS);
      }
      this.logger.error('[KI-Opt] Attempt 1 failed:', error.message);

      // Retry with ultra-short constraints to guarantee the JSON fits in 400 tokens
      const retryPrompt =
        `Optimize this German classified ad. Return ONLY valid JSON, no extra text.\n` +
        `{"improvedTitle":"<max 50 chars>","improvedDescription":"<max 40 words>","improvementSummary":"<max 10 words>"}\n\n` +
        `Ad title: ${title}\nAd category: ${category}`;

      try {
        this.logger.log('[KI-Opt] Calling Gemini API (retry attempt 2)...');
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
          this.logger.error('[KI-Opt] Quota exceeded on retry:', quotaErr.message);
          throw new HttpException(quotaErr.message, HttpStatus.TOO_MANY_REQUESTS);
        }
        this.logger.error('[KI-Opt] Retry failed:', retryError.message, '| raw:', responseText.slice(0, 120));
        throw new HttpException(
          `Fehler bei der KI-Optimierung: Die Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Log Usage to Firestore (Rule Six)
    await this.logUsage(userId, modelUsed, promptTokenCount, candidatesTokenCount, false);

    return parsedJson;
  }

  async suggestPrice(userId: string, title: string) {
    this.assertAiConfigured();

    

    const userPrompt = `Valuate this item title: ${title}`;

    let responseText = '';
    let modelUsed = '';
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
      modelUsed = fallbackResult.modelName;
      promptTokenCount = fallbackResult.promptTokenCount;
      candidatesTokenCount = fallbackResult.candidatesTokenCount;
      const cleaned = cleanAndExtractJson(responseText);
      parsedJson = JSON.parse(cleaned);
    } catch (error: any) {
      this.logger.error('Gemini Price Valuate failed on first attempt. Raw response:', responseText);
      this.logger.error('Parse error:', error);
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
        this.logger.error('Gemini Price Valuate retry failed. Raw response:', responseText);
        this.logger.error('Retry parse error:', retryError);
        throw new HttpException(
          `Fehler bei der Preisanalyse: Die Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Log Usage to Firestore (Rule Six)
    await this.logUsage(userId, modelUsed, promptTokenCount, candidatesTokenCount, false);

    return { suggestedPrice: parsedJson.suggestedPrice, reasoning: parsedJson.reasoning };
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

  async getUserUsage(userId: string): Promise<{ plan: string; callsCount: number; limit: number | null; unlimited: boolean }> {
    const db = this.firebaseService.firestore;

    // 1. Fetch user tier/plan + per-user bonus
    const userDoc = await db.collection('users').doc(userId).get();
    const plan = userDoc.data()?.tier || userDoc.data()?.plan || 'free';
    const bonus = userDoc.data()?.aiLimitBonus || 0;

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

    // 3. Effective limit = plan limit + per-user bonus (single source of truth).
    //    Infinity can't be represented in JSON, so report unlimited explicitly.
    const limit = getEffectiveLimit(plan, bonus);
    const unlimited = limit === Infinity;

    return {
      plan,
      callsCount,
      limit: unlimited ? null : limit,
      unlimited,
    };
  }


  /**
   * Health check — does NOT call Gemini (would burn quota).
   * Validates only: key is present, non-empty, looks like a real key (39+ chars).
   * Returns ok=true if the key is configured; latencyMs=0 (no network call).
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey.trim() === '') {
      return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY not configured' };
    }
    // A real Gemini API key is always 39 characters starting with "AI"
    const looksValid = geminiKey.length >= 30 && !geminiKey.includes('dummy');
    if (!looksValid) {
      return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY looks invalid' };
    }
    return { ok: true, latencyMs: 0 };
  }

  /** Analyze ad photos for quality feedback. Metered, cached, cost-controlled. */
  async getPhotoFeedback(
    userId: string,
    adId: string,
  ): Promise<{
    overall: number;
    scores: Record<string, number>;
    suggestions: string[];
    strengths: string[];
    analyzedAt: string;
  }> {
    const db = this.firebaseService.firestore;

    // Return mock data in development mode for testing
    if (process.env.ENABLE_MOCK_PHOTO_FEEDBACK === 'true') {
      this.logger.log(`[Photo Feedback] MOCK MODE - Returning mock feedback for ad ${adId}`);

      // Get real photos from the ad for carousel
      const adDoc = await db.collection('users').doc(userId).collection('ads').doc(adId).get();
      let photoUrls: string[] = [];
      if (adDoc.exists) {
        const ad = adDoc.data()!;
        photoUrls = (ad.images || ad.pictureUrls || []).filter((p: any) => p) as string[];
        this.logger.log(`[Photo Feedback] Found ${photoUrls.length} photos for carousel: ${photoUrls.map(p => p.substring(0, 50) + '...').join(', ')}`);
      }

      return {
        overall: 72,
        scores: {
          lighting: 80,
          clarity: 60,
          background: 70,
          composition: 78,
          coverage: 65,
        },
        suggestions: [
          'Schärfe erhöhen: Verwende ein Stativ und stelle die Kamera auf den Autofokus ein. Das sorgt für kristallklare Details.',
          'Hintergrund aufräumen: Entferne Unordnung im Hintergrund. Ein neutraler, sauberer Hintergrund wirkt professioneller.',
          'Größe zeigen: Füge ein Objekt zum Größenvergleich hinzu (z.B. eine Hand, ein Lineal), damit Käufer die Größe besser einschätzen können.',
        ],
        strengths: [
          'Gute allgemeine Beleuchtung und Farben',
          'Gut zentrierter Artikel mit angenehmer Komposition',
        ],
        analyzedAt: new Date().toISOString(),
      };
    }

    // 1. Fetch user tier + check quota
    const userDoc = await db.collection('users').doc(userId).get();
    const plan = userDoc.data()?.tier || userDoc.data()?.plan || 'free';

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usageRef = db.collection('aiUsage').doc(userId);
    const usageDoc = await usageRef.get();

    let callsCount = 0;
    if (usageDoc.exists) {
      const data = usageDoc.data()!;
      if (data.month === currentMonth) callsCount = data.callsCount || 0;
    }

    // 2. Enforce quota (use same quota system as AI optimizations)
    const { limit: quota } = await this.getUserUsage(userId);

    // Note: Using same counter as all other AI calls
    if (callsCount >= quota) {
      throw new HttpException(
        `KI-Kontingent erreicht (${callsCount}/${quota}). Resets am 1. nächsten Monat.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Fetch ad + photos
    const adDoc = await db.collection('users').doc(userId).collection('ads').doc(adId).get();
    if (!adDoc.exists) {
      throw new HttpException('Anzeige nicht gefunden', HttpStatus.NOT_FOUND);
    }

    const ad = adDoc.data()!;
    let photoUrls = ad.pictures || ad.images || ad.pictureUrls || [];
    if (typeof photoUrls === 'string') photoUrls = [photoUrls];
    photoUrls = (photoUrls || []).filter((p: any) => p);

    // Fallback: use single image if no photo array exists
    if (photoUrls.length === 0 && (ad.image || ad.adImage)) {
      photoUrls = [ad.image || ad.adImage];
      this.logger.log(`[Photo Feedback] Using fallback thumbnail image`);
    }

    this.logger.log(`[Photo Feedback] 📸 Ad fetched — found ${photoUrls.length} photo(s)`);
    if (photoUrls.length > 0) {
      this.logger.log(`[Photo Feedback]   Photos: ${photoUrls.slice(0, 2).map((u: string) => u.substring(0, 60) + '...').join(', ')}`);
    }

    if (photoUrls.length === 0) {
      throw new HttpException('Keine Fotos in der Anzeige gefunden', HttpStatus.BAD_REQUEST);
    }

    // 4. Check cache: has this photo set been analyzed recently?
    const existingFeedback = ad.photoFeedback;
    const photoHash = this.hashPhotoSet(photoUrls);

    if (existingFeedback && existingFeedback.imageSetHash === photoHash) {
      this.logger.log(`[Photo Feedback] Cache hit for ad ${adId}`);
      return {
        overall: existingFeedback.overall,
        scores: existingFeedback.scores,
        suggestions: existingFeedback.suggestions,
        strengths: existingFeedback.strengths,
        analyzedAt: existingFeedback.analyzedAt,
      };
    }

    // 5. Download + downscale images (cap at 5, max 1024px)
    const imagesToAnalyze = photoUrls.slice(0, 5);
    const base64Images = await Promise.all(
      imagesToAnalyze.map((url: string) => this.downloadAndDownscaleImage(url, 1024)),
    );

    // 6. Call AI (OpenRouter vision model)
    this.assertAiConfigured();

    const imageParts = base64Images.map((data) => ({
      inlineData: { data, mimeType: 'image/jpeg' },
    }));

    const systemPrompt = `You are a marketplace listing photo expert for the German classifieds site Kleinanzeigen.
Analyze the provided product photos for a used-item listing.
Rate each dimension 0-100:
- lighting: brightness, shadows, glare, natural vs flash
- clarity: focus, sharpness, resolution
- background: clean/uncluttered, item is the focus
- composition: framing, angle, item fills the frame, not cut off
- coverage: enough photos and key angles (front, back, detail/close-up, any labels/defects)
Then give 2-4 SPECIFIC, actionable suggestions. Each suggestion must reference a concrete fix.
Do NOT give generic advice like "improve the photos".
Also identify 1-2 things that are already good.
Respond ONLY with valid JSON, no markdown, no extra text:
{
  "overall": <0-100>,
  "scores": {
    "lighting": <0-100>,
    "clarity": <0-100>,
    "background": <0-100>,
    "composition": <0-100>,
    "coverage": <0-100>
  },
  "suggestions": ["<specific fix>", "<specific fix>", ...],
  "strengths": ["<what's good>"]
}`;

    const userPrompt = `Es gibt ${imagesToAnalyze.length} Fotos in dieser Anzeige. Analysiere sie.`;

    const result = await this.executeWithFallback(
      [userPrompt, ...imageParts],
      systemPrompt,
      { responseMimeType: 'application/json', maxOutputTokens: 600 },
      { timeoutMs: AI_CONFIG.imageAnalysisTimeoutMs },
    );

    // 7. Parse response
    let feedbackData;
    try {
      feedbackData = JSON.parse(cleanAndExtractJson(result.responseText));
    } catch (e: any) {
      this.logger.error('Failed to parse photo feedback response:', e.message);
      throw new HttpException('Foto-Analyse fehlgeschlagen', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // 8. Store result + increment usage
    await db
      .collection('users')
      .doc(userId)
      .collection('ads')
      .doc(adId)
      .update({
        photoFeedback: {
          overall: feedbackData.overall,
          scores: feedbackData.scores,
          suggestions: feedbackData.suggestions,
          strengths: feedbackData.strengths,
          analyzedAt: new Date().toISOString(),
          imageSetHash: photoHash,
        },
      });

    // Increment usage (photo feedback costs 2x quota due to vision model cost)
    const quotaCost = 2; // Vision analysis is ~2x more expensive than text
    const newCallsCount = (usageDoc.data()?.callsCount || 0) + quotaCost;
    await usageRef.set(
      {
        month: currentMonth,
        callsCount: newCallsCount,
        lastActive: new Date().toISOString(),
      },
      { merge: true },
    );

    this.logger.log(`[Photo Feedback] ✅ Analyzed ad ${adId} (month: ${currentMonth}, usage: ${newCallsCount}/${quota}, cost: ${quotaCost})`);
    this.logger.log(`[Photo Feedback]    Overall: ${feedbackData.overall}/100, Dimensions: ${Object.keys(feedbackData.scores).length}`);

    return {
      overall: feedbackData.overall,
      scores: feedbackData.scores,
      suggestions: feedbackData.suggestions,
      strengths: feedbackData.strengths,
      analyzedAt: new Date().toISOString(),
    };
  }

  /** Simple hash of photo URLs for cache detection. */
  private hashPhotoSet(urls: string[]): string {
    const concat = urls.join('|');
    let hash = 0;
    for (let i = 0; i < concat.length; i++) {
      const char = concat.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /** Download image from URL and downscale to max size. */
  private async downloadAndDownscaleImage(url: string, maxPx: number): Promise<string> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      const buffer = Buffer.from(response.data);
      // For now, just encode as base64 (in production, use sharp or similar to downscale)
      return buffer.toString('base64');
    } catch (err: any) {
      this.logger.warn(`Failed to download image from ${url}:`, err.message);
      throw new HttpException('Foto konnte nicht geladen werden', HttpStatus.BAD_REQUEST);
    }
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
