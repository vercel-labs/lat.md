import { getLatServerVersion } from '@lat.md/server';
import type { CmdContext } from '@lat.md/core/context';
import { analyzeMarkdownProject, type MarkdownProjectAnalysis } from '@lat.md/core/project-analysis';
import { getLocalVersion } from '../version.js';
import { buildStaticView, type StaticViewBuildOptions, type StaticViewBuildResult } from './static-build.js';
export type ServerViewBuildOptions = Omit<StaticViewBuildOptions, 'searchApi'>;
export type ServerViewBuildResult = StaticViewBuildResult;
export type ServerViewBuildDependencies = {
    analyzeMarkdownProject: typeof analyzeMarkdownProject;
    buildStaticView: typeof buildStaticView;
    getLocalVersion: typeof getLocalVersion;
    getLatServerVersion: typeof getLatServerVersion;
    getPackageVersion: typeof getPackageVersion;
    buildSearchIndex: typeof buildServerSearchIndex;
};
/** Wait for the index process to exit so native handles cannot lock staging. */
export declare function buildServerSearchIndex(latDir: string, project: MarkdownProjectAnalysis, cacheDir: string): Promise<void>;
declare function getPackageVersion(name: string): string;
/** Build immutable UI data plus the small portable Express search service. */
export declare function buildServerView(ctx: CmdContext, requestedOutput: string, options?: ServerViewBuildOptions, dependencies?: ServerViewBuildDependencies): Promise<ServerViewBuildResult>;
export {};
