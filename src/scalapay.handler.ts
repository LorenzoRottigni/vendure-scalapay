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
  PaymentMetadata,
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
   *
   * @param ctx Request context
   * @param order Order object
   * @param amount
   * @param ___
   * @param metadata
   * @returns
   */
  createPayment: async (
    ctx: RequestContext,
    order: Order,
    amount,
    ___,
    metadataPayment: PaymentMetadata
  ): Promise<CreatePaymentResult> => {
    try {
      const metadataOrder: PostV2OrdersResponse | null =
        await scalapayService.createOrder(order);

      if (!metadataOrder) {
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
      if (metadataOrder?.checkoutUrl) {
        try {
          order.customFields.scalapayCheckoutUrl = metadataOrder.checkoutUrl;
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

      const chunks = metadataOrder?.checkoutUrl?.split?.("/") || [];

      const metadata: PostV2PaymentsCaptureResponse | { status: string } =
        (await scalapayService.capturePayment(
          metadataPayment.paymentIntentAmountReceived,
          metadataPayment.paymentIntentToken
        )) || {
          status: "DECLINED",
        };

      return {
        amount: order.total,
        state: "Settled" as const,
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
  settlePayment(): SettlePaymentResult {
    return {
      success: true,
    };
  },

  createRefund: async (
    ctx,
    input,
    amount,
    order,
    payment,
    args
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
