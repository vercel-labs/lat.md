import type { CodeRef } from '@lat.md/core/code-refs';
import { type Section } from '@lat.md/core/lattice-model';
import { type MarkdownFileAnalysis, type MarkdownParagraph } from '@lat.md/core/markdown-analysis';
import { type WikiLinkResolver } from './markdown.js';
import type { ViewCodeBackReference, ViewSectionBackReferences, ViewSourceReference } from './protocol.js';
export type SourceReferenceOrigin = {
    sectionId: string;
    line: number;
};
type ParagraphContent = MarkdownParagraph;
export type ViewParsedMarkdownFile = MarkdownFileAnalysis;
export type ViewCodeReferenceFile = {
    path: string;
    lines: string[];
    refs: CodeRef[];
};
type IndexedMarkdownReference = {
    kind: 'markdown';
    section: Section;
    sourcePath: string;
    line: number;
    paragraph: ParagraphContent;
    activeWikiLink?: string;
    activeMarkdownLink?: string;
};
type IndexedBackReference = IndexedMarkdownReference | ViewCodeBackReference;
export type ViewReferenceIndex = {
    incomingBySection: ReadonlyMap<string, readonly IndexedBackReference[]>;
    sourceByTarget: ReadonlyMap<string, readonly IndexedMarkdownReference[]>;
    sourceReferenceCounts: ReadonlyMap<string, number>;
    externalByTarget: ReadonlyMap<string, readonly IndexedBackReference[]>;
};
/** Parse one Markdown file once into every structure needed by the view store. */
export declare function parseViewMarkdownFile(absolutePath: string, content: string, latDir: string, projectRoot: string): ViewParsedMarkdownFile;
export declare function linkedSection(url: string, sourcePath: string, sectionsByPath: ReadonlyMap<string, Section[]>): Section | null;
/** Resolve cached outgoing occurrences into direct section and source indexes. */
export declare function buildViewReferenceIndex(markdownFiles: Iterable<ViewParsedMarkdownFile>, codeFiles: Iterable<ViewCodeReferenceFile>, allSections: Section[], resolveExternalTarget?: (target: string) => string | null): ViewReferenceIndex;
/** Render exact local Markdown and code backlinks for external targets. */
export declare function renderExternalSectionBackReferences(index: ViewReferenceIndex, targets: ReadonlyMap<string, string>, latDir: string, projectRoot: string, createWikiLinkResolver?: (requestedPath: string) => Promise<WikiLinkResolver>): Promise<ViewSectionBackReferences[]>;
/** Adapt exact external backlinks to the source context presentation. */
export declare function renderExternalSourceReferences(index: ViewReferenceIndex, target: string, latDir: string, projectRoot: string, createWikiLinkResolver?: (requestedPath: string) => Promise<WikiLinkResolver>): Promise<ViewSourceReference[]>;
/** Render direct reverse-index entries for the sections visible in one file. */
export declare function renderSectionBackReferences(index: ViewReferenceIndex, visibleSections: Section[], latDir: string, projectRoot: string, createWikiLinkResolver?: (requestedPath: string) => Promise<WikiLinkResolver>): Promise<ViewSectionBackReferences[]>;
/** Render cached Markdown occurrences that point to one source target. */
export declare function renderSourceReferenceContext(index: ViewReferenceIndex, target: string, origin: SourceReferenceOrigin | undefined, latDir: string, projectRoot: string, createWikiLinkResolver?: (requestedPath: string) => Promise<WikiLinkResolver>): Promise<{
    context: ViewSourceReference | null;
    otherReferences: ViewSourceReference[];
}>;
export {};
