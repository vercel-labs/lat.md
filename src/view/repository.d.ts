import { type Section } from '@lat.md/core/lattice-model';
import { type ExternalResolver } from '@lat.md/core/external-sources';
import type { ExternalTarget } from '@lat.md/core/external-sources';
import { renderExternalDocumentTree } from './external-document-tree.js';
import type { ViewExternalDocument, ViewSourceDocument } from './protocol.js';
import { type SourceReferenceOrigin, type ViewReferenceIndex } from './references.js';
export declare class ViewDocumentNotFoundError extends Error {
}
export declare class ViewSourceNotFoundError extends Error {
}
export declare class ViewExternalNotFoundError extends Error {
}
export declare function externalUrl(target: string): string;
/** Make repository-relative external-document links reflect pulled files. */
export declare function resolveExternalDocumentLinks(tree: Awaited<ReturnType<typeof renderExternalDocumentTree>>, current: ExternalTarget, external: ExternalResolver, referenceIndex: ViewReferenceIndex): typeof tree;
export declare function createMarkdownWikiLinkResolver(latDir: string, requestedPath: string, loadedSections: Section[], referenceIndex?: ViewReferenceIndex, externalResolver?: ExternalResolver, publishable?: (path: string) => Promise<boolean>): Promise<(target: string, context: {
    line: number;
}) => Promise<{
    href: string;
    referenceCount: number;
} | null>>;
/** Resolve and render one configured external file through the normal view models. */
export declare function getViewExternal(latDir: string, projectRoot: string, targetValue: string, external: ExternalResolver, allSections: Section[], referenceIndex: ViewReferenceIndex, publishable?: (path: string) => Promise<boolean>): Promise<ViewExternalDocument>;
/** Read and highlight a source file after constraining it to the project root. */
export declare function getViewSource(latDir: string, projectRoot: string, requestedPath: string, requestedSymbol?: string, origin?: SourceReferenceOrigin, requestedLine?: number, allSections?: Section[], referenceIndex?: ViewReferenceIndex, publishable?: (path: string) => Promise<boolean>): Promise<ViewSourceDocument>;
