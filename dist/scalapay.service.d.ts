import { OrderService, RequestContext, Order, OrderState, TransactionalConnection, Payment, EntityHydrator } from "@vendure/core";
import type { PostV2OrdersResponse, PostV2PaymentsCaptureResponse, ScalapayPluginOptions } from "./types";
export declare class ScalapayService {
    private connection;
    private orderService;
    private entityHydratorService;
    private options;
    constructor(connection: TransactionalConnection, orderService: OrderService, entityHydratorService: EntityHydrator, options: ScalapayPluginOptions);
    /**
     * @description Create a new Scalapay Order.
     * @param {Order} order Vendure order from which to create the Scalapay order.
     * @returns {Promise<PostV2OrdersResponse | null>}
     */
    createOrder(order: Order): Promise<PostV2OrdersResponse | null>;
    /**
     * @description Settle Scalapay payment, inject order.customFields.scalapayToken, trigger scalapay.handler.settlePayment.
     * @param {RequestContext} ctx
     * @param {string} orderStatus Query param from Scalapay confirmation redirect.
     * @param {string} orderId Query param from Scalapay confirmation redirect.
     * @param {string} orderToken Query param from Scalapay confirmation redirect.
     * @returns {Promise<boolean>} Settle status
     */
    settlePayment(ctx: RequestContext, orderStatus: string, orderId: string, orderToken: string, fallbackState?: OrderState): Promise<boolean>;
    /**
     * @description Capture Scalapay payment, retrieve payment metadata.
     * @param {Payment} payment Vendure payment to be captured.
     * @param {string} token Scalapay generated token.
     * @returns {Promise<PostV2PaymentsCaptureResponse | null>}
     */
    capturePayment(payment: Payment, token: string): Promise<PostV2PaymentsCaptureResponse | null>;
    refundPayment(amount: number): Promise<object | undefined>;
    /**
     * @description Normalize Vendure Order schema to Scalapay createOrder input schema.
     * @param {Order} order Order to be normalized.
     * @returns {ScalapayCreateOrderInput} Normalized request input.
     */
    private normalizeCreateOrderInput;
}
