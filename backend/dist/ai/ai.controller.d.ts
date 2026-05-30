import { AiService } from './ai.service';
import { Observable } from 'rxjs';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    optimizeAd(adId: string): Promise<{
        optimizedTitle: string;
        optimizedDescription: string;
        reasoning: string;
    }>;
    suggestPrice(adId: string): Promise<{
        suggestedPrice: number;
        minPrice: number;
        maxPrice: number;
        reasoning: string;
    }>;
    suggestSchedule(adId: string): Promise<{
        recommendedDayOfWeek: string;
        recommendedHour: number;
        confidenceLevel: string;
        reasoning: string;
    }>;
    chat(message: string, context: any): Promise<Observable<any>>;
}
