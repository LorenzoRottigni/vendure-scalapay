# Scalapay Payment Plugin for Vendure

## Overview

This plugin integrates Scalapay, a flexible and user-friendly payment solution, with your Vendure e-commerce platform. It enables seamless transactions and enhances the checkout experience for your customers.

## Installation

Install the Scalapay plugin via npm, pnpm, or yarn:

```bash
npm install vendure-scalapay
# OR
pnpm install vendure-scalapay
# OR
yarn add vendure-scalapay
```

## Configuration

In your `vendure-config.ts` file, initialize the ScalapayPlugin with the following options:

```typescript
import { ScalapayPlugin } from "vendure-scalapay";

export const config = {
  plugins: [
    ScalapayPlugin.init({
      apiKey: "<scalapay-api-key>",
      baseUrl: "<vendure-app-base-url>",
      successUrl: "<front-end-success-url>",
      failureUrl: "<front-end-failure-url>",
      environment: "<sandbox|production>",
    }),
  ],
};
```

## Plugin Options

- `apiKey`: Your Scalapay API key (can be accessed via `process.env.SCALAPAY_API_KEY`).
- `baseUrl`: The public base URL of your Vendure application (can be accessed via `process.env.SCALAPAY_BASE_URL`).
- `successUrl`: The URL to redirect to upon successful Scalapay payment settlement (can be accessed via `process.env.SCALAPAY_SUCCESS_URL`).
- `failureUrl`: The URL to redirect to in case of failed Scalapay payment settlement (can be accessed via `process.env.SCALAPAY_FAILURE_URL`).
- `environment`: Scalapay runtime environment <sandbox/production> (can be accessed via `process.env.SCALAPAY_ENVIRONMENT`).

## Functionality

The Scalapay Plugin extends Vendure by adding two Order Custom Fields:

- order.customFields.scalapayCheckoutUrl: This field stores the Scalapay generated checkout URL, where customers submit their payment.
- order.customFields.scalapayToken: This field holds the Scalapay generated token at the time of payment settlement.

Additionally, the plugin exposes a REST endpoint (GET /payments/scalapay) to handle the Scalapay checkoutUrl redirect, settle the payment, and then redirect the client (302) to the designated success/failure URL.

Please ensure you have the necessary environment variables set to securely access Scalapay credentials.

For more detailed information, refer to the [Scalapay documentation](https://developers.scalapay.com/).

**Note**: It is recommended to follow best practices for securely managing environment variables.

```bash
export SCALAPAY_API_KEY='<your-api-key>'
export SCALAPAY_BASE_URL='<your-app-base-url>'
export SCALAPAY_SUCCESS_URL='<front-end-success-url>'
export SCALAPAY_FAILURE_URL='<front-end-failure-url>'
export SCALAPAY_ENVIRONMENT='<sandbox|production>'
```

## Support and Reporting Issues

If you encounter any issues, discover a bug, or have suggestions for improvements, please feel free to contact me or open an issue on GitHub repository.

For urgent matters or specific inquiries, you can reach me out at **Email**: lorenzo@rottigni.net

I appreciate your feedback and I will do my best to address any concerns in a timely manner. Thank you for using Scalapay Payment Plugin!
