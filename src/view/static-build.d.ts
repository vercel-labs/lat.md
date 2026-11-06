import { rename } from 'node:fs/promises';
import type { CmdContext } from '@lat.md/core/context';
export type StaticViewBuildOptions = {
    basePath?: string;
    clientDir?: string;
    codeExcludePaths?: string[];
    force?: boolean;
    logoText?: string;
    externalCa?: string | Buffer;
    searchApi?: string;
};
export type StaticViewBuildResult = {
    documents: number;
    outputDir: string;
    sources: number;
};
export declare function normalizeStaticViewBasePath(value: string): string;
/** Convert a live view route to its physical static-directory URL. */
export declare function staticViewUrl(value: string, basePath: string, entryPath?: string): string;
/** Refuse build targets that exist or could replace the project itself. */
export declare function validateViewBuildOutput(outputDir: string, projectRoot: string, kind?: string, force?: boolean): Promise<void>;
type ViewBuildMoveDependencies = {
    move: typeof rename;
    wait: (milliseconds: number) => Promise<void>;
};
/** Commit a staged build after transient filesystem locks have cleared. */
export declare function moveViewBuildOutput(stagingDir: string, outputDir: string, dependencies?: ViewBuildMoveDependencies): Promise<void>;
/** Remove abandoned staging after transient filesystem locks have cleared. */
export declare function removeViewBuildStaging(stagingDir: string): Promise<void>;
/** Build a serverless snapshot of the current read-only Lat UI. */
export declare function buildStaticView(ctx: CmdContext, requestedOutput: string, options?: StaticViewBuildOptions): Promise<StaticViewBuildResult>;
export {};
