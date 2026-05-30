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
exports.SupportController = void 0;
const common_1 = require("@nestjs/common");
let SupportController = class SupportController {
    getSupportConfig() {
        return {
            paypalDonateUrl: process.env.PAYPAL_DONATE_URL,
            githubUrl: process.env.GITHUB_URL || 'https://github.com/yourusername/anzeigenboost',
            kofiUrl: process.env.KOFI_URL,
            message: 'AnzeigenBoost ist ein Einzelprojekt. Wenn das Tool dir hilft, freue ich mich über eine kleine Unterstützung! ☕',
        };
    }
};
exports.SupportController = SupportController;
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getSupportConfig", null);
exports.SupportController = SupportController = __decorate([
    (0, common_1.Controller)('support')
], SupportController);
//# sourceMappingURL=support.controller.js.map