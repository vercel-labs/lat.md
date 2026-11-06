import type { CmdContext, CmdResult } from '@lat.md/core/context';
import { buildServerView, type ServerViewBuildOptions, type ServerViewBuildResult } from '../view/server-build.js';
export type ServerViewBuildTarget = 'node' | 'vercel';
export type UiBuildServerOptions = ServerViewBuildOptions & {
    target?: ServerViewBuildTarget;
};
export type UiBuildServerDependencies = {
    buildNode: typeof buildServerView;
    buildVercel?: (ctx: CmdContext, output: string, options: ServerViewBuildOptions) => Promise<ServerViewBuildResult>;
};
/** Export immutable UI data with a Node or Vercel semantic-search service. */
export declare function uiBuildServerCommand(ctx: CmdContext, output: string | undefined, options?: UiBuildServerOptions, dependencies?: UiBuildServerDependencies): Promise<CmdResult>;
