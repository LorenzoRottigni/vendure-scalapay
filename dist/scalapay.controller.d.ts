import { RequestContext } from "@vendure/core";
import { ScalapayService } from "./scalapay.service";
import { ScalapayPluginOptions } from "./types";
export declare class ScalapayController {
    private scalapayService;
    private options;
    constructor(scalapayService: ScalapayService, options: ScalapayPluginOptions);
    settlePayment(ctx: RequestContext, orderToken: string, status: string, orderId: string, successUrl?: string, errorUrl?: string): Promise<void | {
        url?: string;
        statusCode?: number;
    }>;
}
