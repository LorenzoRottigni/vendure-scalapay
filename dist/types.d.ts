declare module '@vendure/core/dist/entity/custom-entity-fields' {
    interface CustomOrderFields {
        scalapayCheckoutUrl?: string;
        scalapayToken?: string;
    }
}
export declare enum ScalapayEnvironment {
    sandbox = "sandbox",
    production = "production"
}
export declare interface ScalapayPluginOptions {
    apiKey: string;
    baseUrl: string;
    successUrl: string;
    failureUrl: string;
    environment: ScalapayEnvironment;
}
export declare interface ScalapayAmount {
    amount?: string;
    currency?: string;
}
export declare interface ScalapayConsumer {
    phoneNumber?: string;
    givenNames?: string;
    surname?: string;
    email?: string;
}
export declare interface ScalapayAddress {
    phoneNumber?: string;
    countryCode?: string;
    name?: string;
    postcode?: string;
    suburb?: string;
    line1?: string;
}
export declare interface ScalapayOrderLine {
    quantity?: number;
    price?: {
        amount?: string;
        currency?: string;
    };
    name?: string;
    category?: string;
    subcategory?: string;
    sku?: string;
    brand?: string;
}
export declare interface ScalapayDiscount {
    displayName?: string;
}
export declare interface ScalapayMerchant {
    redirectCancelUrl?: string;
    redirectConfirmUrl?: string;
}
export declare interface ScalapayCreateOrderInput {
    totalAmount: ScalapayAmount;
    consumer: ScalapayConsumer;
    billing?: ScalapayAddress;
    shipping: ScalapayAddress;
    items: ScalapayOrderLine[];
    discounts?: ScalapayDiscount[];
    merchant: ScalapayMerchant;
    shippingAmount?: ScalapayAmount;
}
export declare interface ScalapayCaptureOrderInput {
    amount: ScalapayAmount;
    token: string;
}
export declare interface PostV2OrdersResponse {
    token: string;
    expires: string;
    checkoutUrl: string;
}
export declare interface PostV2PaymentsCaptureResponse {
    token: string;
    status: string;
    totalAmount: string;
    orderDetails: ScalapayCreateOrderInput;
}
export declare interface ScalapaySDK {
    postV2Orders(payload: ScalapayCreateOrderInput): Promise<{
        data: PostV2OrdersResponse;
    }>;
    postV2PaymentsCapture(payload: ScalapayCaptureOrderInput): Promise<{
        data: PostV2PaymentsCaptureResponse;
    }>;
    server(s: string): void;
    auth(s: string): void;
}
