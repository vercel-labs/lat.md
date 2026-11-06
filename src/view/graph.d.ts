import { type Section } from '@lat.md/core/lattice-model';
import type { ViewDocumentError, ViewGraph } from './protocol.js';
import type { ViewCodeReferenceFile, ViewParsedMarkdownFile, ViewReferenceIndex } from './references.js';
import type { ViewGitSnapshot } from './git.js';
import type { ExternalResolver } from '@lat.md/core/external-sources';
/** Project the cached view state into stable nodes and weighted relationships. */
export declare function buildViewGraph(markdownFiles: Iterable<ViewParsedMarkdownFile>, codeFiles: Iterable<ViewCodeReferenceFile>, allSections: Section[], diagnostics: ReadonlyMap<string, readonly ViewDocumentError[]>, git: ViewGitSnapshot, generation: number, references: ViewReferenceIndex, external?: ExternalResolver): ViewGraph;
