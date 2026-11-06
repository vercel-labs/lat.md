import type { Root } from 'mdast';
import type { ViewDocumentTree } from './protocol.js';
export type WikiLinkContext = {
    line: number;
};
export type WikiLinkResolution = {
    href: string;
    referenceCount: number;
};
export type WikiLinkResolver = (target: string, context: WikiLinkContext) => WikiLinkResolution | null | Promise<WikiLinkResolution | null>;
export type MarkdownRenderOptions = {
    activeMarkdownLink?: string;
    activeWikiLink?: string;
    errors?: {
        anchor: string;
        line: number;
        marker: 'heading' | 'line' | 'target';
        target: string;
    }[];
    lineOffset?: number;
    rewriteMarkdownLink?: (url: string) => string;
};
/** Normalize a lat.md file into the safe, parser-neutral view tree. */
export declare function renderMarkdown(markdown: string, filePath: string, resolveWikiLink?: WikiLinkResolver, options?: MarkdownRenderOptions, parsedTree?: Root): Promise<{
    tree: ViewDocumentTree;
    title: string;
}>;
