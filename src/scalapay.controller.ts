import { Controller, Get, Inject, Query, Redirect } from "@nestjs/common";
import { Ctx, Logger, RequestContext, Transaction } from "@vendure/core";
import { ScalapayService } from "./scalapay.service";
import { SCALAPAY_PLUGIN_OPTIONS, loggerCtx } from "./constants";
import { ScalapayPluginOptions } from "./types";

@Controller("payments")
export class ScalapayController {
  constructor(
    private scalapayService: ScalapayService,
    @Inject(SCALAPAY_PLUGIN_OPTIONS) private options: ScalapayPluginOptions,
  ) {}

  @Get("scalapay")
  @Transaction()
  @Redirect(undefined, 302)
  /**
   * @description GET /payments/scalapay controller.
   * Handles the Scalapay confirm/cancel redirect after payment submission that occurs
   * on Scalapay checkoutUrl (generated at scalapay.handler.createPayment()).
   */
  async settlePayment(
    @Ctx() ctx: RequestContext,
    @Query("orderToken") orderToken: string,
    @Query("status") status: string,
    @Query("orderId") orderId: string,
    successUrl = this.options.successUrl,
    errorUrl = this.options.failureUrl,
  ): Promise<void | { url?: string; statusCode?: number }> {
    try {
      if (!orderId || !status || !orderToken || !ctx.session?.id) {
        !ctx.session?.id
          ? Logger.error(`Unable to retrieve current session within received request.`)
          : Logger.error(`Unable to settle Scalapay payment due to bad request.`);
        return { url: errorUrl };
      }
      const settleStatus = await this.scalapayService.settlePayment(
        ctx,
        status,
        orderId,
        orderToken,
      );
      if (!settleStatus) {
        return { url: errorUrl };
      }
      return {
        url: `${successUrl.replace("<order-id>", orderId)}?order=${orderId}`,
      };
    } catch (err: any) {
      Logger.error(err, loggerCtx);
      return { url: errorUrl };
    }
  }
}
