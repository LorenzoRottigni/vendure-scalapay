import { Inject, Injectable } from "@nestjs/common";
import api from 'api'
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
} from "@vendure/core";
import type {
  PostV2OrdersResponse,
  PostV2PaymentsCaptureResponse,
  ScalapayCaptureOrderInput,
  ScalapayCreateOrderInput,
  ScalapayPluginOptions,
  ScalapaySDK
} from "./types";
import { SCALAPAY_PLUGIN_OPTIONS, loggerCtx } from "./constants";

@Injectable()
export class ScalapayService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private entityHydratorService: EntityHydrator,
        @Inject(SCALAPAY_PLUGIN_OPTIONS) private options: ScalapayPluginOptions,
    ) {}

    /**
     * @description Create a new Scalapay Order.
     * @param {Order} order Vendure order from which to create the Scalapay order.
     * @returns {Promise<PostV2OrdersResponse | null>}
     */
    public async createOrder(order: Order): Promise<PostV2OrdersResponse | null> {
        try {
          const sdk = api('@scalapaydocs/v1.1#4won2elk6oqe21') as ScalapaySDK
          sdk.server('https://integration.api.scalapay.com');
          sdk.auth(`Bearer ${this.options.apiKey}`)

          const payload = this.normalizeCreateOrderInput(order)
          const { data } = await sdk.postV2Orders(payload)

          return data
        } catch(err: any) {
          Logger.error(err)
          return null
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
    public async settlePayment(
        ctx: RequestContext,
        orderStatus: string,
        orderId: string,
        orderToken: string,
        fallbackState: OrderState = 'AddingItems'
    ): Promise<boolean> {
        try {
          const order = await this.orderService.findOne(ctx, orderId, ["payments"])
          if (!order) {
              Logger.error(`An error occurred while trying to retrieve order ${orderId}.`)
              await this.orderService.transitionToState(ctx, orderId, fallbackState)
              return false
          }

          const scalapayPayments = order?.payments?.filter?.((payment) => payment?.method?.toLowerCase() === 'scalapay') || []
          if (scalapayPayments.length === 0) {
              Logger.error(`An error occurred while trying to retrieve Scalapay payments from order ${orderId}.`)
              await this.orderService.transitionToState(ctx, orderId, fallbackState)
              return false
          }

          order.customFields.scalapayToken = orderToken
          await this.entityHydratorService.hydrate(ctx, order, { relations: ['lines'] })
          await this.connection.getRepository(ctx, Order).save(order, { reload: false })

          for (const payment of scalapayPayments) {
            await this.orderService.settlePayment(ctx, payment.id)
          }

          if (orderStatus?.toLowerCase() !== 'success') {
              Logger.error(`An error occurred while trying to settle the Scalapay payment for order ${orderId}.`)
              await this.orderService.transitionToState(ctx, orderId, fallbackState)
              return false
          }

          return true
        } catch(err: any) {
          Logger.error(err, loggerCtx)
          return false
        }
    }

    /**
     * @description Capture Scalapay payment, retrieve payment metadata.
     * @param {Payment} payment Vendure payment to be captured.
     * @param {string} token Scalapay generated token.
     * @returns {Promise<PostV2PaymentsCaptureResponse | null>}
     */
    public async capturePayment(
      payment: Payment,
      token: string
    ): Promise<PostV2PaymentsCaptureResponse | null> {
        try {
          const sdk = api('@scalapaydocs/v1.1#tfpblg5few2e') as ScalapaySDK
          sdk.server('https://integration.api.scalapay.com');
          sdk.auth(`Bearer ${this.options.apiKey}`)

          const payload: ScalapayCaptureOrderInput = {
            amount: {
              amount: payment?.amount ? (payment.amount / 100)?.toString() : undefined,
              currency: 'EUR'
            },
            token
          }
        
          const { data: metadata }: {
            data: PostV2PaymentsCaptureResponse
          } = await sdk.postV2PaymentsCapture(payload)

          return metadata
        } catch(err: any) {
          Logger.error(err, loggerCtx)
          return null
        }
    }

    /**
     * @description Normalize Vendure Order schema to Scalapay createOrder input schema.
     * @param {Order} order Order to be normalized.
     * @returns {ScalapayCreateOrderInput} Normalized request input.
     */
    private normalizeCreateOrderInput(order: Order): ScalapayCreateOrderInput {
        const payload: ScalapayCreateOrderInput = {
          totalAmount: {
            amount: order?.totalWithTax ? (order?.totalWithTax / 100)?.toString() : '0',
            currency: 'EUR'
          },
          consumer: {
            phoneNumber: order?.customer?.phoneNumber,
            givenNames: order?.customer?.firstName,
            surname: order?.customer?.lastName,
            email: order?.customer?.emailAddress,
          },
          billing: {
            phoneNumber: order?.billingAddress?.phoneNumber,
            countryCode: order?.billingAddress?.countryCode,
            name: order?.billingAddress?.fullName,
            postcode: order?.billingAddress?.postalCode,
            suburb: order?.billingAddress?.city,
            line1: order?.billingAddress?.streetLine1,
          },
          shipping: {
            phoneNumber: order?.shippingAddress?.phoneNumber,
            countryCode: order?.shippingAddress?.countryCode,
            name: order?.shippingAddress?.fullName,
            postcode: order?.shippingAddress?.postalCode,
            suburb: order?.shippingAddress?.city,
            line1: order?.shippingAddress?.streetLine1,
          },
          items: order?.lines.map(({ quantity, linePriceWithTax, productVariant}: OrderLine) => ({
            quantity,
            price: {
              amount: linePriceWithTax ? (linePriceWithTax / 100)?.toString() : '0',
              currency: 'EUR'
            },
            name: productVariant?.name,
            // category: productVariant?.customFields?.primaryCategory?.name,
            // subcategory: productVariant?.customFields?.selectedCategory?.name,
            sku: productVariant?.sku,
            // brand: productVariant?.customFields?.brand?.[0]?.name,
          })),
          discounts: order?.discounts?.map(({ amountWithTax }) => ({
            displayName: `${amountWithTax}%off`,
          })),
          merchant: {
            redirectCancelUrl: `${this.options?.baseUrl}/payments/scalapay?orderId=${order?.id}`,
            redirectConfirmUrl: `${this.options?.baseUrl}/payments/scalapay?orderId=${order?.id}`,
          },
          shippingAmount: undefined
        }

        // fill shipping amount if not free
        if (order.shippingWithTax) {
          payload.shippingAmount = {
            amount: order?.shippingWithTax ? (order?.shippingWithTax / 100)?.toString() : '0',
            currency: 'EUR',
          }
        }
        return payload
    }
}