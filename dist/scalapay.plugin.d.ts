import { Type } from "@vendure/core";
import { type ScalapayPluginOptions } from "./types";
export declare class ScalapayPlugin {
    static options: ScalapayPluginOptions;
    static init(options: ScalapayPluginOptions): Type<ScalapayPlugin>;
}
