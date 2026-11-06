/** Resolve ordinary code links relative to their Markdown file, not the vault root. */
export declare function rewriteLocalFileLink(value: string, sourcePath: string): string;
export type ViewSourceTarget = {
    path: string;
    symbol: string;
    key: string;
    fileKey: string;
};
/** Normalize a supported source wiki-link target for view indexes and routes. */
export declare function viewSourceTarget(target: string): ViewSourceTarget | null;
