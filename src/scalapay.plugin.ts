import {
  LanguageCode,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from "@vendure/core";
import { SCALAPAY_PLUGIN_OPTIONS } from "./constants";
import scalapayPaymentHandler from "./scalapay.handler";
import { ScalapayService } from "./scalapay.service";
import { ScalapayEnvironment, type ScalapayPluginOptions } from "./types";
import { ScalapayController } from "./scalapay.controller";

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [ScalapayController],
  providers: [
    ScalapayService,
    {
      provide: SCALAPAY_PLUGIN_OPTIONS,
      useFactory: () => ScalapayPlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(scalapayPaymentHandler);
    config.customFields.Order.push({
      name: "scalapayCheckoutUrl",
      type: "string",
      label: [
        { languageCode: LanguageCode.en, value: "Scalapay checkout url" },
      ],
      nullable: true,
      public: true,
      readonly: true,
    });
    config.customFields.Order.push({
      name: "scalapayToken",
      type: "string",
      label: [{ languageCode: LanguageCode.en, value: "Scalapay token" }],
      nullable: true,
      public: true,
      readonly: true,
    });
    return config;
  },
})
export class ScalapayPlugin {
  static options: ScalapayPluginOptions;

  static init(options: ScalapayPluginOptions): Type<ScalapayPlugin> {
    this.options = {
      apiKey: process.env.SCALAPAY_API_KEY || options.apiKey,
      baseUrl: process.env.SCALAPAY_BASE_URL || options.baseUrl,
      successUrl: process.env.SCALAPAY_SUCCESS_URL || options.successUrl,
      failureUrl: process.env.SCALAPAY_FAILURE_URL || options.failureUrl,
      environment:
        process.env.SCALAPAY_ENVIRONMENT === ScalapayEnvironment.sandbox ||
        process.env.SCALAPAY_ENVIRONMENT === ScalapayEnvironment.production
          ? process.env.SCALAPAY_ENVIRONMENT
          : options.environment || ScalapayEnvironment.sandbox,
    };
    return ScalapayPlugin;
  }
}
