import {
  PaymentMethodHandler,
  CreatePaymentResult,
  SettlePaymentResult,
  SettlePaymentErrorResult,
  LanguageCode,
  Logger,
  CreateRefundResult,
  TransactionalConnection,
  Injector,
  Order,
  RequestContext,
  Payment,
} from "@vendure/core";
import { ScalapayService } from "./scalapay.service";
import type {
  PostV2OrdersResponse,
  PostV2PaymentsCaptureResponse,
} from "./types";
import { loggerCtx } from "./constants";

let connection: TransactionalConnection;
let scalapayService: ScalapayService;

const scalapayPaymentHandler = new PaymentMethodHandler({
  code: "scalapay",
  description: [
    {
      languageCode: LanguageCode.en,
      value: "Scalapay",
    },
    {
      languageCode: LanguageCode.it,
      value: "Scalapay",
    },
  ],
  args: {
    apiKey: { type: "string" },
    baseUrl: { type: "string" },
    successUrl: { type: "string" },
    failureUrl: { type: "string" },
    environment: { type: "string" },
  },
  init(injector: Injector) {
    connection = injector.get(TransactionalConnection);
    scalapayService = injector.get(ScalapayService);
  },
  /**
   * @description Triggers on addPaymentToOrder: create a new Scalapay payment intent trough ScalapaySDK.
   * Injects a checkoutUrl at order.customFields.scalapayCheckoutUrl in order to make user able to retrieve the checkoutUrl.
   * @param {RequestContext} ctx
   * @param {Order} order
   * @returns {Promise<CreatePaymentResult>} Payment result object.
   */
  createPayment: async (
    ctx: RequestContext,
    order: Order,
  ): Promise<CreatePaymentResult> => {
    try {
      const metadata: PostV2OrdersResponse | null =
        await scalapayService.createOrder(order);

      if (!metadata) {
        return {
          amount: order.total,
          state: "Declined" as const,
          metadata: {
            errorMessage:
              "An error occurred while trying to retrieve the customer checkoutUrl.",
          },
        };
      }

      // store checkoutUrl into order.customFields
      if (metadata?.checkoutUrl) {
        try {
          order.customFields.scalapayCheckoutUrl = metadata.checkoutUrl;
          await connection
            .getRepository(ctx, Order)
            .save(order, { reload: false });
        } catch (e: any) {
          Logger.error(e, loggerCtx);
          return {
            amount: order.total,
            state: "Declined" as const,
            metadata: {
              errorMessage: e,
              message: "Unable to set order.customFields.checkoutUrl",
            },
          };
        }
      }

      const chunks = metadata?.checkoutUrl?.split?.("/") || [];

      return {
        amount: order.total,
        state: "Authorized" as const,
        transactionId: chunks?.[chunks.length - 1] || undefined,
        metadata,
      };
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return {
        amount: order.total,
        state: "Declined" as const,
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
  settlePayment: async (
    ctx: RequestContext,
    order: Order,
    payment: Payment,
  ): Promise<SettlePaymentResult | SettlePaymentErrorResult> => {
    try {
      const token: string | null = order?.customFields?.scalapayToken || null;

      if (!token) {
        return {
          success: false,
          state: "Error",
          errorMessage: `An error occurred while trying to retrieve Scalapay capture token within order ${order?.id}`,
        } as SettlePaymentErrorResult;
      }

      const metadata: PostV2PaymentsCaptureResponse | { status: string } =
        (await scalapayService.capturePayment(payment, token)) || {
          status: "DECLINED",
        };

      return {
        success: metadata?.status?.toLowerCase?.() === "approved",
        metadata,
      };
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return {
        success: false,
        state: "Error",
        errorMessage: err,
      } as SettlePaymentErrorResult;
    }
  },
  createRefund: async (
    ctx,
    input,
    amount,
    order,
    payment,
    args,
  ): Promise<CreateRefundResult> => {
    try {
      const metadata = await scalapayService.refundPayment(amount);
      return {
        state: "Settled",
        transactionId: payment.transactionId,
        metadata,
      };
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return {
        state: "Failed",
        transactionId: "",
        metadata: {
          error: err,
        },
      };
    }
  },
});

export default scalapayPaymentHandler;
