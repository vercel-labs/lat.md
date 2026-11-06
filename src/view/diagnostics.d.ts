import { type Section } from '@lat.md/core/lattice-model';
import type { ExternalResolver } from '@lat.md/core/external-sources';
import type { ViewDocumentError } from './protocol.js';
import type { ViewCodeReferenceFile, ViewParsedMarkdownFile } from './references.js';
/** Build per-document validation errors entirely from the current view snapshot. */
export declare function buildViewDiagnostics(markdownFiles: Iterable<ViewParsedMarkdownFile>, codeFiles: Iterable<ViewCodeReferenceFile>, allSections: Section[], projectRoot: string, external?: ExternalResolver, latDir?: string): Promise<ReadonlyMap<string, readonly ViewDocumentError[]>>;
