export declare class AiService {
    private openai;
    constructor();
    enforceTokenLimit(userId: string, tokensNeeded?: number): Promise<void>;
    recordUsage(userId: string, tokensUsed: number): Promise<void>;
    optimizeAd(adId: string, userId: string): Promise<{
        optimizedTitle: string;
        optimizedDescription: string;
        reasoning: string;
    }>;
    suggestPrice(adId: string, userId: string): Promise<{
        suggestedPrice: number;
        minPrice: number;
        maxPrice: number;
        reasoning: string;
    }>;
    suggestSchedule(adId: string, userId: string): Promise<{
        recommendedDayOfWeek: string;
        recommendedHour: number;
        confidenceLevel: string;
        reasoning: string;
    }>;
    chat(message: string, userId: string, context?: any): Promise<import("rxjs").Observable<any>>;
}
