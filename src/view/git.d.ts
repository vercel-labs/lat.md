import type { ViewGitFileStatus } from './protocol.js';
export type ViewGitFileSnapshot = {
    status: ViewGitFileStatus;
    baseContent: string;
};
export type ViewGitSnapshot = {
    available: boolean;
    files: ReadonlyMap<string, ViewGitFileSnapshot>;
};
export type ViewGitRepository = {
    root: string;
    latRelative: string;
};
export type ViewGitRunner = (cwd: string, args: string[]) => Promise<string>;
/** Find the Git worktree containing the active lat.md directory. */
export declare function findViewGitRepository(projectRoot: string, latDir: string, runner?: ViewGitRunner): Promise<ViewGitRepository | null>;
/** Read the cached HEAD-to-working-tree state for visible lat.md files. */
export declare function readViewGitSnapshot(repository: ViewGitRepository, currentFiles: ReadonlyMap<string, {
    content: string;
}>, runner?: ViewGitRunner): Promise<ViewGitSnapshot>;
export declare function emptyViewGitSnapshot(): ViewGitSnapshot;
export declare function sameViewGitSnapshot(left: ViewGitSnapshot, right: ViewGitSnapshot): boolean;
