"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const scalapay_service_1 = require("./scalapay.service");
const constants_1 = require("./constants");
let connection;
let scalapayService;
const scalapayPaymentHandler = new core_1.PaymentMethodHandler({
    code: 'scalapay',
    description: [{
            languageCode: core_1.LanguageCode.en,
            value: 'Scalapay',
        },
        {
            languageCode: core_1.LanguageCode.it,
            value: 'Scalapay',
        }],
    args: {
        apiKey: { type: 'string' },
        baseUrl: { type: 'string' },
        successUrl: { type: 'string' },
        failureUrl: { type: 'string' },
        environment: { type: 'string' }
    },
    init(injector) {
        connection = injector.get(core_1.TransactionalConnection);
        scalapayService = injector.get(scalapay_service_1.ScalapayService);
    },
    /**
     * @description Triggers on addPaymentToOrder: create a new Scalapay payment intent trough ScalapaySDK.
     * Injects a checkoutUrl at order.customFields.scalapayCheckoutUrl in order to make user able to retrieve the checkoutUrl.
     * @param {RequestContext} ctx
     * @param {Order} order
     * @returns {Promise<CreatePaymentResult>} Payment result object.
     */
    createPayment: async (ctx, order) => {
        var _a, _b;
        try {
            const metadata = (await scalapayService.createOrder(order));
            if (!metadata) {
                return {
                    amount: order.total,
                    state: 'Declined',
                    metadata: {
                        errorMessage: 'An error occurred while trying to retrieve the customer checkoutUrl.',
                    },
                };
            }
            // store checkoutUrl into order.customFields
            if (metadata === null || metadata === void 0 ? void 0 : metadata.checkoutUrl) {
                try {
                    order.customFields.scalapayCheckoutUrl = metadata.checkoutUrl;
                    await connection.getRepository(ctx, core_1.Order).save(order, { reload: false });
                }
                catch (e) {
                    core_1.Logger.error(e, constants_1.loggerCtx);
                    return {
                        amount: order.total,
                        state: 'Declined',
                        metadata: {
                            errorMessage: e,
                            message: 'Unable to set order.customFields.checkoutUrl'
                        },
                    };
                }
            }
            const chunks = ((_b = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.checkoutUrl) === null || _a === void 0 ? void 0 : _a.split) === null || _b === void 0 ? void 0 : _b.call(_a, '/')) || [];
            return {
                amount: order.total,
                state: 'Authorized',
                transactionId: (chunks === null || chunks === void 0 ? void 0 : chunks[chunks.length - 1]) || undefined,
                metadata,
            };
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return {
                amount: order.total,
                state: 'Declined',
                metadata: {
                    errorMessage: err,
                },
            };
        }
    },
    /**
     * @description Triggers on order state transition to PaymentSettled or while trying to settle the order payment (orderService.settlePayment()).
     * Capture Scalapay order using the Scalapay query param generated token.
     * @param {RequestContext} ctx
     * @param {Order} order Order containing the payment to be settled.
     * @param {Payment} payment Payment to be settled.
     * @returns {Promise<SettlePaymentResult | SettlePaymentErrorResult>} Payment result object.
     */
    settlePayment: async (ctx, order, payment) => {
        var _a, _b, _c;
        try {
            const token = ((_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.scalapayToken) || null;
            if (!token) {
                return {
                    success: false,
                    state: 'Error',
                    errorMessage: `An error occurred while trying to retrieve Scalapay capture token within order ${order === null || order === void 0 ? void 0 : order.id}`,
                };
            }
            const metadata = (await scalapayService.capturePayment(payment, token)) || { status: 'DECLINED' };
            return {
                success: ((_c = (_b = metadata === null || metadata === void 0 ? void 0 : metadata.status) === null || _b === void 0 ? void 0 : _b.toLowerCase) === null || _c === void 0 ? void 0 : _c.call(_b)) === 'approved',
                metadata,
            };
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return {
                success: false,
                state: 'Error',
                errorMessage: err,
            };
        }
    },
    createRefund: async (ctx, input, amount, order, payment, args) => {
        try {
            const metadata = await scalapayService.refundPayment(amount);
            return {
                state: 'Settled',
                transactionId: payment.transactionId,
                metadata
            };
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return {
                state: 'Failed',
                transactionId: '',
                metadata: {
                    error: err
                }
            };
        }
    },
});
exports.default = scalapayPaymentHandler;
