import type { Section, SectionMatch } from '@lat.md/core/lattice-model';
import { type SearchDb } from './db.js';
import { type CreateSearchEngine } from './embedder.js';
import { type SearchResult } from './search.js';
export type IndexedSearchResult = {
    query: string;
    matches: SectionMatch[];
};
export type IndexedSearchSession = {
    search: (query: string, limit: number, minSimilarity?: number) => Promise<SearchResult[]>;
    close: () => Promise<void>;
};
/** Resolve scored index rows against one already-analyzed project snapshot. */
export declare function resolveSearchMatches(results: readonly SearchResult[], sectionById: ReadonlyMap<string, Section>): SectionMatch[];
/** Reuse an embedder with scoped database access for a sequence of index queries. */
export declare function openIndexedSearchSession(latDir: string, options?: {
    cacheDir?: string;
    createSearchEngine?: CreateSearchEngine;
}): Promise<IndexedSearchSession>;
/** Query a finished index and resolve its ids from precomputed section data. */
export declare function searchIndexedSections(latDir: string, query: string, limit: number, sectionById: ReadonlyMap<string, Section>, options?: {
    cacheDir?: string;
    minSimilarity?: number;
}): Promise<IndexedSearchResult>;
export declare function indexMetadata(db: SearchDb): Promise<Map<string, string>>;
export declare function sameIndexMetadata(a: Map<string, string>, b: Map<string, string>): boolean;
