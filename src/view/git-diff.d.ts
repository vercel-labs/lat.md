import type { Root } from 'mdast';
/** Build a renderable Markdown tree with HEAD deletions and local additions. */
export declare function buildGitDiffTree(baseMarkdown: string, currentMarkdown: string, currentTree?: Root): Root;
