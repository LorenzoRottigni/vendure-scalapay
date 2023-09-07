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
exports.ScalapayController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const scalapay_service_1 = require("./scalapay.service");
const constants_1 = require("./constants");
let ScalapayController = class ScalapayController {
    constructor(scalapayService, options) {
        this.scalapayService = scalapayService;
        this.options = options;
    }
    /**
     * @description GET /payments/scalapay controller.
     * Handles the Scalapay confirm/cancel redirect after payment submission that occurs
     * on Scalapay checkoutUrl (generated at scalapay.handler.createPayment()).
     */
    async settlePayment(ctx, orderToken, status, orderId, successUrl = this.options.successUrl, errorUrl = this.options.failureUrl) {
        try {
            if (!ctx.activeUserId || !orderId || !status || !orderToken) {
                core_1.Logger.error(`Unable to settle Scalapay payment due to bad request.`);
                return { url: errorUrl };
            }
            const settleStatus = await this.scalapayService.settlePayment(ctx, status, orderId, orderToken);
            if (!settleStatus) {
                return { url: errorUrl };
            }
            return { url: `${successUrl}?order=${orderId}` };
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return { url: errorUrl };
        }
    }
};
exports.ScalapayController = ScalapayController;
__decorate([
    (0, common_1.Get)('scalapay'),
    (0, core_1.Transaction)(),
    (0, common_1.Redirect)(undefined, 302)
    /**
     * @description GET /payments/scalapay controller.
     * Handles the Scalapay confirm/cancel redirect after payment submission that occurs
     * on Scalapay checkoutUrl (generated at scalapay.handler.createPayment()).
     */
    ,
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, common_1.Query)('orderToken')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ScalapayController.prototype, "settlePayment", null);
exports.ScalapayController = ScalapayController = __decorate([
    (0, common_1.Controller)('payments'),
    __param(1, (0, common_1.Inject)(constants_1.SCALAPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [scalapay_service_1.ScalapayService, Object])
], ScalapayController);
