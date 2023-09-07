"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScalapayUrl = void 0;
const constants_1 = require("./constants");
const types_1 = require("./types");
const getScalapayUrl = (env) => env === types_1.ScalapayEnvironment.production
    ? constants_1.SCALAPAY_SANDBOX_URL
    : constants_1.SCALAPAY_PRODUCTION_URL;
exports.getScalapayUrl = getScalapayUrl;
