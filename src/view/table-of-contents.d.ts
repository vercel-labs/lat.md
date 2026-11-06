import type { Root } from 'mdast';
import { type Section } from '@lat.md/core/lattice-model';
import type { ViewDocumentError, ViewDocumentTocItem } from './protocol.js';
export type ViewTableOfContentsOptions = {
    errors?: readonly ViewDocumentError[];
    gitTree?: Root | null;
};
/** Project rendered headings into the document's local navigation. */
export declare function buildViewTableOfContents(sections: Section[], titles: readonly string[], options?: ViewTableOfContentsOptions): ViewDocumentTocItem[];
