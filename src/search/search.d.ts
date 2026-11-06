import type { SearchDb } from './db.js';
import type { Embedder } from './embedder.js';
import type { SearchResult } from './types.js';
export type { SearchResult, SearchEvidence, SearchDiagnostics, } from './types.js';
export declare const DEFAULT_SEARCH_LIMIT = 5;
export declare const DEFAULT_MIN_SIMILARITY = 0.2;
export type Candidate = {
    id: number;
    sectionId: string;
    score: number;
    exact?: boolean;
};
export declare function collapse(candidates: Candidate[]): Map<string, Candidate & {
    rank: number;
}>;
export declare function literalFtsQuery(query: string): string;
export declare function searchSections(db: SearchDb, query: string, embedder: Embedder, limit?: number, minSimilarity?: number, preparedVector?: number[]): Promise<SearchResult[]>;
/** Prepare embeddings before acquiring a database access lock. */
export declare function prepareSearchQuery(query: string, embedder: Embedder, limit?: number, minSimilarity?: number): Promise<number[]>;
