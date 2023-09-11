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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalapayService = void 0;
const common_1 = require("@nestjs/common");
const api_1 = __importDefault(require("api"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const common_2 = require("./common");
let ScalapayService = class ScalapayService {
    constructor(connection, orderService, entityHydratorService, options) {
        this.connection = connection;
        this.orderService = orderService;
        this.entityHydratorService = entityHydratorService;
        this.options = options;
        core_1.Logger.info("SCALAPAY PLUGIN OPTIONS:");
        core_1.Logger.info(JSON.stringify(this.options, null, 2));
    }
    /**
     * @description Create a new Scalapay Order.
     * @param {Order} order Vendure order from which to create the Scalapay order.
     * @returns {Promise<PostV2OrdersResponse | null>}
     */
    async createOrder(order) {
        try {
            const sdk = (0, api_1.default)("@scalapaydocs/v1.1#4won2elk6oqe21");
            sdk.server((0, common_2.getScalapayUrl)(this.options.environment));
            sdk.auth(`Bearer ${this.options.apiKey}`);
            const payload = this.normalizeCreateOrderInput(order);
            const { data } = await sdk.postV2Orders(payload);
            return data;
        }
        catch (err) {
            core_1.Logger.error(err);
            return null;
        }
    }
    /**
     * @description Settle Scalapay payment, inject order.customFields.scalapayToken, trigger scalapay.handler.settlePayment.
     * @param {RequestContext} ctx
     * @param {string} orderStatus Query param from Scalapay confirmation redirect.
     * @param {string} orderId Query param from Scalapay confirmation redirect.
     * @param {string} orderToken Query param from Scalapay confirmation redirect.
     * @returns {Promise<boolean>} Settle status
     */
    async settlePayment(ctx, orderStatus, orderId, orderToken, fallbackState = "AddingItems") {
        var _a, _b;
        try {
            if ((orderStatus === null || orderStatus === void 0 ? void 0 : orderStatus.toLowerCase()) !== "success") {
                core_1.Logger.error(`An error occurred while trying to settle the Scalapay payment for order ${orderId}.`);
                await this.orderService.transitionToState(ctx, orderId, fallbackState);
                return false;
            }
            const order = await this.orderService.findOne(ctx, orderId, ["payments"]);
            if (!order) {
                core_1.Logger.error(`An error occurred while trying to retrieve order ${orderId}.`);
                await this.orderService.transitionToState(ctx, orderId, fallbackState);
                return false;
            }
            const scalapayPayments = ((_b = (_a = order === null || order === void 0 ? void 0 : order.payments) === null || _a === void 0 ? void 0 : _a.filter) === null || _b === void 0 ? void 0 : _b.call(_a, (payment) => { var _a; return ((_a = payment === null || payment === void 0 ? void 0 : payment.method) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "scalapay"; })) || [];
            if (scalapayPayments.length === 0) {
                core_1.Logger.error(`An error occurred while trying to retrieve Scalapay payments from order ${orderId}.`);
                await this.orderService.transitionToState(ctx, orderId, fallbackState);
                return false;
            }
            order.customFields.scalapayToken = orderToken;
            await this.entityHydratorService.hydrate(ctx, order, {
                relations: ["lines"],
            });
            await this.connection
                .getRepository(ctx, core_1.Order)
                .save(order, { reload: false });
            const settledPayments = await Promise.all(scalapayPayments.map(async (payment) => {
                try {
                    const result = await this.orderService.settlePayment(ctx, payment.id);
                    if (result.message) {
                        throw Error(`Error settling payment ${payment.id} for order ${order.code}: ${result.errorCode} - ${result.message}`);
                    }
                    return result;
                }
                catch (err) {
                    core_1.Logger.error(err, constants_1.loggerCtx);
                    return null;
                }
            }));
            return !settledPayments.includes(null);
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return false;
        }
    }
    /**
     * @description Capture Scalapay payment, retrieve payment metadata.
     * @param {Payment} payment Vendure payment to be captured.
     * @param {string} token Scalapay generated token.
     * @returns {Promise<PostV2PaymentsCaptureResponse | null>}
     */
    async capturePayment(payment, token) {
        var _a;
        try {
            const sdk = (0, api_1.default)("@scalapaydocs/v1.1#tfpblg5few2e");
            sdk.server((0, common_2.getScalapayUrl)(this.options.environment));
            sdk.auth(`Bearer ${this.options.apiKey}`);
            const payload = {
                amount: {
                    amount: (payment === null || payment === void 0 ? void 0 : payment.amount)
                        ? (_a = (payment.amount / 100)) === null || _a === void 0 ? void 0 : _a.toString()
                        : undefined,
                    currency: "EUR",
                },
                token,
            };
            const { data: metadata, } = await sdk.postV2PaymentsCapture(payload);
            return metadata;
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
            return null;
        }
    }
    async refundPayment(amount) {
        var _a;
        try {
            const url = `${(0, common_2.getScalapayUrl)(this.options.environment)}/v2/payments/refund`;
            const options = {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                    Authorization: `Bearer ${this.options.apiKey}`,
                },
                body: JSON.stringify({
                    refundAmount: {
                        currency: "EUR",
                        amount: amount ? (_a = (amount / 100)) === null || _a === void 0 ? void 0 : _a.toString() : "0",
                    },
                }),
            };
            const data = await (0, node_fetch_1.default)(url, options);
            const metadata = (await data.json());
            return metadata;
        }
        catch (err) {
            core_1.Logger.error(err, constants_1.loggerCtx);
        }
    }
    /**
     * @description Normalize Vendure Order schema to Scalapay createOrder input schema.
     * @param {Order} order Order to be normalized.
     * @returns {ScalapayCreateOrderInput} Normalized request input.
     */
    normalizeCreateOrderInput(order) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
        const fallbackName = ((_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.firstName) || ((_b = order === null || order === void 0 ? void 0 : order.customer) === null || _b === void 0 ? void 0 : _b.lastName)
            ? `${(_c = order === null || order === void 0 ? void 0 : order.customer) === null || _c === void 0 ? void 0 : _c.firstName} ${(_d = order === null || order === void 0 ? void 0 : order.customer) === null || _d === void 0 ? void 0 : _d.lastName}`
            : undefined;
        const payload = {
            totalAmount: {
                amount: (order === null || order === void 0 ? void 0 : order.totalWithTax)
                    ? (_e = ((order === null || order === void 0 ? void 0 : order.totalWithTax) / 100)) === null || _e === void 0 ? void 0 : _e.toString()
                    : "0",
                currency: "EUR",
            },
            consumer: {
                phoneNumber: (_f = order === null || order === void 0 ? void 0 : order.customer) === null || _f === void 0 ? void 0 : _f.phoneNumber,
                givenNames: (_g = order === null || order === void 0 ? void 0 : order.customer) === null || _g === void 0 ? void 0 : _g.firstName,
                surname: (_h = order === null || order === void 0 ? void 0 : order.customer) === null || _h === void 0 ? void 0 : _h.lastName,
                email: (_j = order === null || order === void 0 ? void 0 : order.customer) === null || _j === void 0 ? void 0 : _j.emailAddress,
            },
            billing: {
                phoneNumber: (_k = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _k === void 0 ? void 0 : _k.phoneNumber,
                countryCode: (_m = (_l = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _l === void 0 ? void 0 : _l.countryCode) === null || _m === void 0 ? void 0 : _m.toUpperCase(),
                name: ((_o = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _o === void 0 ? void 0 : _o.fullName) || fallbackName,
                postcode: (_p = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _p === void 0 ? void 0 : _p.postalCode,
                suburb: (_q = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _q === void 0 ? void 0 : _q.city,
                line1: (_r = order === null || order === void 0 ? void 0 : order.billingAddress) === null || _r === void 0 ? void 0 : _r.streetLine1,
            },
            shipping: {
                phoneNumber: (_s = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _s === void 0 ? void 0 : _s.phoneNumber,
                countryCode: (_u = (_t = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _t === void 0 ? void 0 : _t.countryCode) === null || _u === void 0 ? void 0 : _u.toUpperCase(),
                name: ((_v = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _v === void 0 ? void 0 : _v.fullName) || fallbackName,
                postcode: (_w = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _w === void 0 ? void 0 : _w.postalCode,
                suburb: (_x = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _x === void 0 ? void 0 : _x.city,
                line1: (_y = order === null || order === void 0 ? void 0 : order.shippingAddress) === null || _y === void 0 ? void 0 : _y.streetLine1,
            },
            items: order === null || order === void 0 ? void 0 : order.lines.map(({ quantity, linePriceWithTax, productVariant }) => {
                var _a;
                return ({
                    quantity,
                    price: {
                        amount: linePriceWithTax
                            ? (_a = (linePriceWithTax / 100)) === null || _a === void 0 ? void 0 : _a.toString()
                            : "0",
                        currency: "EUR",
                    },
                    name: productVariant === null || productVariant === void 0 ? void 0 : productVariant.name,
                    // category: productVariant?.customFields?.primaryCategory?.name,
                    // subcategory: productVariant?.customFields?.selectedCategory?.name,
                    sku: productVariant === null || productVariant === void 0 ? void 0 : productVariant.sku,
                    // brand: productVariant?.customFields?.brand?.[0]?.name,
                });
            }),
            discounts: (_z = order === null || order === void 0 ? void 0 : order.discounts) === null || _z === void 0 ? void 0 : _z.map(({ amountWithTax }) => ({
                displayName: `${amountWithTax}%off`,
            })),
            merchant: {
                redirectCancelUrl: `${(_0 = this.options) === null || _0 === void 0 ? void 0 : _0.baseUrl}/payments/scalapay?orderId=${order === null || order === void 0 ? void 0 : order.id}`,
                redirectConfirmUrl: `${(_1 = this.options) === null || _1 === void 0 ? void 0 : _1.baseUrl}/payments/scalapay?orderId=${order === null || order === void 0 ? void 0 : order.id}`,
            },
            shippingAmount: undefined,
        };
        // fill shipping amount if not free
        if (order.shippingWithTax) {
            payload.shippingAmount = {
                amount: (order === null || order === void 0 ? void 0 : order.shippingWithTax)
                    ? (_2 = ((order === null || order === void 0 ? void 0 : order.shippingWithTax) / 100)) === null || _2 === void 0 ? void 0 : _2.toString()
                    : "0",
                currency: "EUR",
            };
        }
        return payload;
    }
};
ScalapayService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(constants_1.SCALAPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.EntityHydrator, Object])
], ScalapayService);
exports.ScalapayService = ScalapayService;
