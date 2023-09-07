import {
  LanguageCode,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from "@vendure/core";
import {
    SCALAPAY_PLUGIN_OPTIONS
} from './constants'
import scalapayPaymentHandler from "./scalapay.handler";
import { ScalapayService } from "./scalapay.service";
import type { ScalapayPluginOptions } from "./types";
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
  configuration: config => {
    config.paymentOptions.paymentMethodHandlers.push(scalapayPaymentHandler);
    config.customFields.Order.push({
        name: 'scalapayCheckoutUrl',
        type: 'string',
        label: [{ languageCode: LanguageCode.en, value: 'Scalapay checkout url' }],
        nullable: true,
        public: true,
        readonly: true,
    });
    config.customFields.Order.push({
      name: 'scalapayToken',
      type: 'string',
      label: [{ languageCode: LanguageCode.en, value: 'Scalapay token' }],
      nullable: true,
      public: true,
      readonly: true,
  });
    return config;
  },
})
export class ScalapayPlugin {
  static options: ScalapayPluginOptions

  static init(options: ScalapayPluginOptions): Type<ScalapayPlugin> {
    this.options = options;
    return ScalapayPlugin;
  }
}


