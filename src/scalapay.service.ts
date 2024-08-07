import { Inject, Injectable } from "@nestjs/common";
import api from "api";
import fetch from "node-fetch";
import {
  Logger,
  OrderService,
  RequestContext,
  Order,
  OrderState,
  TransactionalConnection,
  Payment,
  OrderLine,
  EntityHydrator,
  OrderStateTransitionError,
  PaymentMethod,
  PaymentMethodService,
  InternalServerError,
} from "@vendure/core";
import type {
  PostV2OrdersResponse,
  PostV2PaymentsCaptureResponse,
  ScalapayCaptureOrderInput,
  ScalapayCreateOrderInput,
  ScalapayPluginOptions,
  ScalapaySDK,
} from "./types";
import { SCALAPAY_PLUGIN_OPTIONS, loggerCtx } from "./constants";
import { getScalapayUrl } from "./common";
import scalapayPaymentHandler from "./scalapay.handler";

@Injectable()
export class ScalapayService {
  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private entityHydratorService: EntityHydrator,
    private paymentMethodService: PaymentMethodService,
    @Inject(SCALAPAY_PLUGIN_OPTIONS) private options: ScalapayPluginOptions
  ) {
    Logger.info("SCALAPAY PLUGIN OPTIONS:");
    Logger.info(JSON.stringify(this.options, null, 2));
  }

  /**
   * @description Create a new Scalapay Order.
   * @param {Order} order Vendure order from which to create the Scalapay order.
   * @returns {Promise<PostV2OrdersResponse | null>}
   */
  public async createOrder(order: Order): Promise<PostV2OrdersResponse | null> {
    try {
      const sdk = api("@scalapaydocs/v1.1#4won2elk6oqe21") as ScalapaySDK;

      sdk.server(getScalapayUrl(this.options.environment));
      sdk.auth(`Bearer ${this.options.apiKey}`);

      const payload = this.normalizeCreateOrderInput(order);
      const { data } = await sdk.postV2Orders(payload);

      return data;
    } catch (err: any) {
      Logger.error(err);
      return null;
    }
  }

  /**
   * @description Settle Scalapay payment, inject order.customFields.scalapayToken, trigger scalapay.handler.settlePayment.
   * @param {RequestContext} ctx
   * @param {string} orderStatus Query param from Scalapay confirmation redirect.
   * @param {string} orderId Query param from Scalapay confirmation redirect.
   * @param {string} orderToken Query param from Scalapay confirmation redirect.
   * @param {string} merchantReference Query param from Scalapay
   * @param {string} totalAmount Query param from Scalapay
   * @returns {Promise<boolean>} Settle status
   */
  public async settlePayment(
    ctx: RequestContext,
    orderStatus: string,
    orderId: string,
    orderToken: string,
    merchantReference: string | null,
    totalAmount: string | null,
    fallbackState: OrderState = "AddingItems"
  ): Promise<boolean> {
    try {
      if (orderStatus?.toLowerCase() !== "success") {
        Logger.error(
          `An error occurred while trying to settle the Scalapay payment for order ${orderId}.`
        );
        await this.orderService.transitionToState(ctx, orderId, fallbackState);
        return false;
      }

      const order = await this.orderService.findOne(ctx, orderId, ["payments"]);

      if (!order) {
        Logger.error(
          `An error occurred while trying to retrieve order ${orderId}.`
        );
        await this.orderService.transitionToState(ctx, orderId, fallbackState);
        return false;
      }

      if (order.state !== "ArrangingPayment") {
        const transitionToStateResult =
          await this.orderService.transitionToState(
            ctx,
            orderId,
            "ArrangingPayment"
          );

        if (transitionToStateResult instanceof OrderStateTransitionError) {
          Logger.error(
            `Error transitioning orderId ${orderId} to ArrangingPayment state: ${transitionToStateResult.message}`,
            loggerCtx
          );
          await this.orderService.transitionToState(
            ctx,
            orderId,
            fallbackState
          );
          return false;
        }
      }

      const paymentMethod = await this.getPaymentMethod(ctx);

      const addPaymentToOrderResult = await this.orderService.addPaymentToOrder(
        ctx,
        orderId,
        {
          method: paymentMethod.code,
          metadata: {
            paymentIntentAmountReceived: totalAmount,
            paymentIntentToken: orderToken,
            paymentScalapayStatus: orderStatus,
          },
        }
      );

      if (!(addPaymentToOrderResult instanceof Order)) {
        Logger.error(
          `Error adding payment to order ${orderId}: ${addPaymentToOrderResult.message}`,
          loggerCtx
        );
        await this.orderService.transitionToState(ctx, orderId, fallbackState);
        return false;
      }

      order.customFields.scalapayToken = orderToken;

      await this.entityHydratorService.hydrate(ctx, order, {
        relations: ["lines"],
      });

      await this.connection
        .getRepository(ctx, Order)
        .save(order, { reload: false });

      return true;
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return false;
    }
  }

  private async getPaymentMethod(ctx: RequestContext): Promise<PaymentMethod> {
    const method = (await this.paymentMethodService.findAll(ctx)).items.find(
      (m) => m.handler.code === scalapayPaymentHandler.code
    );

    if (!method) {
      throw new InternalServerError(
        `[${loggerCtx}] Could not find Stripe PaymentMethod`
      );
    }

    return method;
  }

  /**
   * @description Capture Scalapay payment, retrieve payment metadata.
   * @param {Payment} payment Vendure payment to be captured.
   * @param {string} token Scalapay generated token.
   * @returns {Promise<PostV2PaymentsCaptureResponse | null>}
   */
  public async capturePayment(
    amount: string | undefined,
    token: string
  ): Promise<PostV2PaymentsCaptureResponse | null> {
    try {
      const sdk = api("@scalapaydocs/v1.1#tfpblg5few2e") as ScalapaySDK;
      sdk.server(getScalapayUrl(this.options.environment));
      sdk.auth(`Bearer ${this.options.apiKey}`);

      const payload: ScalapayCaptureOrderInput = {
        amount: {
          amount: amount,
          currency: "EUR",
        },
        token,
      };

      const {
        data: metadata,
      }: {
        data: PostV2PaymentsCaptureResponse;
      } = await sdk.postV2PaymentsCapture(payload);

      return metadata;
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return null;
    }
  }

  public async refundPayment(amount: number) {
    try {
      const url = `${getScalapayUrl(
        this.options.environment
      )}/v2/payments/refund`;
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
            amount: amount ? (amount / 100)?.toString() : "0",
          },
        }),
      };

      const data = await fetch(url, options);
      const metadata = (await data.json()) as object;
      return metadata;
    } catch (err: any) {
      Logger.error(err, loggerCtx);
    }
  }

  /**
   * @description Normalize Vendure Order schema to Scalapay createOrder input schema.
   * @param {Order} order Order to be normalized.
   * @returns {ScalapayCreateOrderInput} Normalized request input.
   */
  private normalizeCreateOrderInput(order: Order): ScalapayCreateOrderInput {
    const fallbackName =
      order?.customer?.firstName || order?.customer?.lastName
        ? `${order?.customer?.firstName} ${order?.customer?.lastName}`
        : undefined;
    const payload: ScalapayCreateOrderInput = {
      totalAmount: {
        amount: order?.totalWithTax
          ? (order?.totalWithTax / 100)?.toString()
          : "0",
        currency: "EUR",
      },
      consumer: {
        phoneNumber: order?.customer?.phoneNumber,
        givenNames: order?.customer?.firstName,
        surname: order?.customer?.lastName,
        email: order?.customer?.emailAddress,
      },
      billing: {
        phoneNumber: order?.billingAddress?.phoneNumber,
        countryCode: order?.billingAddress?.countryCode?.toUpperCase(),
        name: order?.billingAddress?.fullName || fallbackName,
        postcode: order?.billingAddress?.postalCode,
        suburb: order?.billingAddress?.city,
        line1: order?.billingAddress?.streetLine1,
      },
      shipping: {
        phoneNumber: order?.shippingAddress?.phoneNumber,
        countryCode: order?.shippingAddress?.countryCode?.toUpperCase(),
        name: order?.shippingAddress?.fullName || fallbackName,
        postcode: order?.shippingAddress?.postalCode,
        suburb: order?.shippingAddress?.city,
        line1: order?.shippingAddress?.streetLine1,
      },
      items: order?.lines.map(
        ({ quantity, linePriceWithTax, productVariant }: OrderLine) => ({
          quantity,
          price: {
            amount: linePriceWithTax
              ? (linePriceWithTax / 100)?.toString()
              : "0",
            currency: "EUR",
          },
          name: productVariant?.name,
          // category: productVariant?.customFields?.primaryCategory?.name,
          // subcategory: productVariant?.customFields?.selectedCategory?.name,
          sku: productVariant?.sku,
          // brand: productVariant?.customFields?.brand?.[0]?.name,
        })
      ),
      discounts: order?.discounts?.map(({ amountWithTax }) => ({
        displayName: `${amountWithTax}%off`,
      })),
      merchant: {
        redirectCancelUrl: `${this.options?.baseUrl}/payments/scalapay?orderId=${order?.id}`,
        redirectConfirmUrl: `${this.options?.baseUrl}/payments/scalapay?orderId=${order?.id}`,
      },
      shippingAmount: undefined,
    };

    // fill shipping amount if not free
    if (order.shippingWithTax) {
      payload.shippingAmount = {
        amount: order?.shippingWithTax
          ? (order?.shippingWithTax / 100)?.toString()
          : "0",
        currency: "EUR",
      };
    }
    return payload;
  }
}
