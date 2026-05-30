"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = require("openai");
const rxjs_1 = require("rxjs");
let AiService = class AiService {
    constructor() {
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    async enforceTokenLimit(userId, tokensNeeded = 0) {
    }
    async recordUsage(userId, tokensUsed) {
    }
    async optimizeAd(adId, userId) {
        await this.enforceTokenLimit(userId);
        return {
            optimizedTitle: 'Stub Title',
            optimizedDescription: 'Stub Description',
            reasoning: 'Stub reasoning'
        };
    }
    async suggestPrice(adId, userId) {
        await this.enforceTokenLimit(userId);
        return {
            suggestedPrice: 100,
            minPrice: 80,
            maxPrice: 120,
            reasoning: 'Stub reasoning'
        };
    }
    async suggestSchedule(adId, userId) {
        await this.enforceTokenLimit(userId);
        return {
            recommendedDayOfWeek: 'Mittwoch',
            recommendedHour: 18,
            confidenceLevel: 'Hoch',
            reasoning: 'Stub reasoning'
        };
    }
    async chat(message, userId, context) {
        await this.enforceTokenLimit(userId);
        const stream = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Du bist AnzeigenBoost Assistent. Du hilfst deutschen Kleinanzeigen-Verkäufern. Wenn der Nutzer fragt, wie er helfen/unterstützen kann, erwähne PayPal und Ko-fi.',
                },
                { role: 'user', content: message }
            ],
            stream: true,
        });
        const subject = new rxjs_1.Subject();
        (async () => {
            let tokensUsed = 0;
            try {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        subject.next({ data: { content } });
                    }
                }
                subject.complete();
                await this.recordUsage(userId, tokensUsed);
            }
            catch (e) {
                subject.error(e);
            }
        })();
        return subject.asObservable();
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map