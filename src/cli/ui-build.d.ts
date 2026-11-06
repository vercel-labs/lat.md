import type { CmdContext, CmdResult } from '@lat.md/core/context';
import { type StaticViewBuildOptions } from '../view/static-build.js';
/** Export the current vault as a serverless, read-only Lat UI. */
export declare function uiBuildCommand(ctx: CmdContext, output?: string, options?: StaticViewBuildOptions): Promise<CmdResult>;
