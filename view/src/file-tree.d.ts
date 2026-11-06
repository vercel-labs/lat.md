import type { ViewExternalFile, ViewGitFileStatus, ViewIndex } from '../../src/view/protocol';
export type FileTreeNode = {
    kind: 'directory';
    name: string;
    path: string;
    children: FileTreeNode[];
} | {
    kind: 'file';
    name: string;
    path: string;
    externalTarget?: string;
    externalPathTarget?: string;
};
/** Return the conventional name/name.md index for a directory, when present. */
export declare function directoryIndex(directory: Extract<FileTreeNode, {
    kind: 'directory';
}>): Extract<FileTreeNode, {
    kind: 'file';
}> | null;
/** Ensure an indexed directory is visibly expanded before navigating into it. */
export declare function expandDirectory(directory: {
    open: boolean;
} | null): void;
/** Sum validation errors below a file or directory for propagated markers. */
export declare function fileTreeErrorCount(node: FileTreeNode, errorCounts: Readonly<Record<string, number>>): number;
/** Collapse descendant Git state into one directory marker. */
export declare function fileTreeGitStatus(node: FileTreeNode, gitFiles: Readonly<Record<string, ViewGitFileStatus>>): ViewGitFileStatus | null;
/** Convert vault-relative file paths into the hierarchy shown in the sidebar. */
export declare function buildFileTree(files: string[], directoryOrder?: ViewIndex['directoryOrder'], entry?: string): FileTreeNode[];
/** Group referenced external files into source-handle roots for the sidebar. */
export declare function buildExternalFileTree(files: ViewExternalFile[]): FileTreeNode[];
