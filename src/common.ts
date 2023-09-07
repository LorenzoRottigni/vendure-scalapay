import { SCALAPAY_PRODUCTION_URL, SCALAPAY_SANDBOX_URL } from "./constants"
import { ScalapayEnvironment } from "./types"

export const getScalapayUrl = (env: ScalapayEnvironment) => env === ScalapayEnvironment.production
    ? SCALAPAY_PRODUCTION_URL
    : SCALAPAY_SANDBOX_URL