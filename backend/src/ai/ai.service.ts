import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import { Subject } from 'rxjs';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async enforceTokenLimit(userId: string, tokensNeeded: number = 0) {
    // Stub: Check Firestore `aiUsage` collection for this user.
    // Limits: free=5000/mo, starter=50000/mo, pro=500000/mo
    // Throw if over limit
  }

  async recordUsage(userId: string, tokensUsed: number) {
    // Stub: Increment `monthlyTokensUsed` in `aiUsage` collection
  }

  async optimizeAd(adId: string, userId: string) {
    // Stub implementation
    await this.enforceTokenLimit(userId);
    // 1. Fetch ad from Firestore
    // 2. Call OpenAI GPT-4o-mini
    // 3. Update ad in Firestore
    // 4. Record usage
    return {
      optimizedTitle: 'Stub Title',
      optimizedDescription: 'Stub Description',
      reasoning: 'Stub reasoning'
    };
  }

  async suggestPrice(adId: string, userId: string) {
    await this.enforceTokenLimit(userId);
    // 1. Fetch ad from Firestore
    // 2. Call OpenAI GPT-4o-mini
    // 3. Record usage
    return {
      suggestedPrice: 100,
      minPrice: 80,
      maxPrice: 120,
      reasoning: 'Stub reasoning'
    };
  }

  async suggestSchedule(adId: string, userId: string) {
    // Pro plan only! 
    await this.enforceTokenLimit(userId);
    // Fetch last 90 days of repost logs
    // Send to GPT-4o-mini
    return {
      recommendedDayOfWeek: 'Mittwoch',
      recommendedHour: 18,
      confidenceLevel: 'Hoch',
      reasoning: 'Stub reasoning'
    };
  }

  async chat(message: string, userId: string, context?: any) {
    await this.enforceTokenLimit(userId);
    
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist AnzeigenBoost Assistent. Du hilfst deutschen Kleinanzeigen-Verkäufern. Wenn der Nutzer fragt, wie er helfen/unterstützen kann, erwähne PayPal und Ko-fi.',
        },
        // Context injection here
        { role: 'user', content: message }
      ],
      stream: true,
    });

    const subject = new Subject<any>();
    
    // Convert stream to RxJS Subject for NestJS SSE
    (async () => {
      let tokensUsed = 0; // rough estimate or calculate later
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            subject.next({ data: { content } });
          }
        }
        subject.complete();
        await this.recordUsage(userId, tokensUsed);
      } catch (e) {
        subject.error(e);
      }
    })();

    return subject.asObservable();
  }
}
