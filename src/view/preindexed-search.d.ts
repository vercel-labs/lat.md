import type { Section } from '@lat.md/core/lattice-model';
import type { CreateSearchEngine } from '../search/embedder.js';
import { type IndexedSearchSession } from '../search/query.js';
import type { ViewSearchResponse } from './protocol.js';
export type PreindexedViewSearchDependencies = {
    openSearchSession: (latDir: string, options: {
        cacheDir?: string;
        createSearchEngine?: CreateSearchEngine;
    }) => Promise<IndexedSearchSession>;
};
export type PreindexedViewSearch = ((query: string) => Promise<ViewSearchResponse>) & {
    close: () => Promise<void>;
};
/** Serve a built search index without importing indexing or Markdown parsers. */
export declare function createPreindexedViewSearch(latDir: string, cacheDir: string, sections: readonly Section[], documentPaths: ReadonlyMap<string, string>, dependencies?: PreindexedViewSearchDependencies, createSearchEngine?: CreateSearchEngine): Promise<PreindexedViewSearch>;
