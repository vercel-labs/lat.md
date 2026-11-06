import type { CmdContext } from '@lat.md/core/context';
import { buildServerView, type ServerViewBuildOptions, type ServerViewBuildResult } from './server-build.js';
import { type VercelBuildOptions, type VercelBuildResult } from './vercel-build.js';
export type VercelServerBuildDependencies = {
    buildNode: typeof buildServerView;
    buildOutput: (artifact: string, output: string, options: VercelBuildOptions) => Promise<VercelBuildResult>;
    installDependencies: (artifact: string) => Promise<void>;
};
/** Build the portable server in staging, install it, then emit Vercel v3 output. */
export declare function buildVercelServerView(ctx: CmdContext, requestedOutput: string, options?: ServerViewBuildOptions, dependencies?: VercelServerBuildDependencies): Promise<ServerViewBuildResult>;
