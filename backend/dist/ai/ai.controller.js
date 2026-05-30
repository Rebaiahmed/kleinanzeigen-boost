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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
let AiController = class AiController {
    constructor(aiService) {
        this.aiService = aiService;
    }
    async optimizeAd(adId) {
        const userId = 'stub-user-id';
        return this.aiService.optimizeAd(adId, userId);
    }
    async suggestPrice(adId) {
        const userId = 'stub-user-id';
        return this.aiService.suggestPrice(adId, userId);
    }
    async suggestSchedule(adId) {
        const userId = 'stub-user-id';
        return this.aiService.suggestSchedule(adId, userId);
    }
    async chat(message, context) {
        const userId = 'stub-user-id';
        return this.aiService.chat(message, userId, context);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('optimize-ad'),
    __param(0, (0, common_1.Body)('adId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "optimizeAd", null);
__decorate([
    (0, common_1.Post)('suggest-price'),
    __param(0, (0, common_1.Body)('adId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "suggestPrice", null);
__decorate([
    (0, common_1.Post)('suggest-schedule'),
    __param(0, (0, common_1.Body)('adId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "suggestSchedule", null);
__decorate([
    (0, common_1.Sse)('chat'),
    __param(0, (0, common_1.Body)('message')),
    __param(1, (0, common_1.Body)('context')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "chat", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map