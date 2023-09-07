import { PaymentMethodHandler } from '@vendure/core';
declare const scalapayPaymentHandler: PaymentMethodHandler<{
    apiKey: {
        type: "string";
    };
    baseUrl: {
        type: "string";
    };
    successUrl: {
        type: "string";
    };
    failureUrl: {
        type: "string";
    };
    environment: {
        type: "string";
    };
}>;
export default scalapayPaymentHandler;
