"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ScalapayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalapayPlugin = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const scalapay_handler_1 = __importDefault(require("./scalapay.handler"));
const scalapay_service_1 = require("./scalapay.service");
const types_1 = require("./types");
const scalapay_controller_1 = require("./scalapay.controller");
let ScalapayPlugin = ScalapayPlugin_1 = class ScalapayPlugin {
    static init(options) {
        this.options = {
            apiKey: process.env.SCALAPAY_API_KEY || options.apiKey,
            baseUrl: process.env.SCALAPAY_BASE_URL || options.baseUrl,
            successUrl: process.env.SCALAPAY_SUCCESS_URL || options.successUrl,
            failureUrl: process.env.SCALAPAY_FAILURE_URL || options.failureUrl,
            environment: (process.env.SCALAPAY_ENVIRONMENT === types_1.ScalapayEnvironment.sandbox ||
                process.env.SCALAPAY_ENVIRONMENT === types_1.ScalapayEnvironment.production)
                ? process.env.SCALAPAY_ENVIRONMENT
                : options.environment || types_1.ScalapayEnvironment.sandbox
        };
        return ScalapayPlugin_1;
    }
};
ScalapayPlugin = ScalapayPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [scalapay_controller_1.ScalapayController],
        providers: [
            scalapay_service_1.ScalapayService,
            {
                provide: constants_1.SCALAPAY_PLUGIN_OPTIONS,
                useFactory: () => ScalapayPlugin_1.options,
            },
        ],
        configuration: config => {
            config.paymentOptions.paymentMethodHandlers.push(scalapay_handler_1.default);
            config.customFields.Order.push({
                name: 'scalapayCheckoutUrl',
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Scalapay checkout url' }],
                nullable: true,
                public: true,
                readonly: true,
            });
            config.customFields.Order.push({
                name: 'scalapayToken',
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Scalapay token' }],
                nullable: true,
                public: true,
                readonly: true,
            });
            return config;
        },
    })
], ScalapayPlugin);
exports.ScalapayPlugin = ScalapayPlugin;
