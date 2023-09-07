import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { Ctx, Logger, RequestContext, Transaction } from '@vendure/core';
import { errorToString } from './common';
import { ScalapayService } from './scalapay.service';

@Controller('payments')
export class ScalapayController {
    constructor(private scalapayService: ScalapayService) {}

    @Get('scalapay')
    @Transaction()
    @Redirect('https://sandbox.deesup.com/thank-you', 302)
    /**
     * @description GET /payments/scalapay controller.
     * Handles the Scalapay confirm/cancel redirect after payment submission that occurs
     * on Scalapay checkoutUrl (generated at scalapay.handler.createPayment()).
     */
    async settlePayment(
        @Ctx() ctx: RequestContext,
        @Query('orderToken') orderToken: string,
        @Query('status') status: string,
        @Query('orderId') orderId: string,
        errorUrl = 'https://sandbox.deesup.com/checkout?scalapayError=true'
    ): Promise<void | { url?: string, statusCode?: number}> {
        try {
            if (!ctx.activeUserId || !orderId || !status || !orderToken) {
                Logger.error(`Unable to settle Scalapay payment due to bad request.`)
                return { url: errorUrl }
            }
            const settleStatus = await this.scalapayService.settlePayment(ctx, status, orderId, orderToken)
            if (!settleStatus) {
                return { url: errorUrl }
            }
            return { url: `https://sandbox.deesup.com/thank-you/${orderId}` }
        } catch (err) {
            Logger.error(errorToString(err));
            return { url: errorUrl }
        }
    }
}