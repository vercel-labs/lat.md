import type { Section, SectionMatch } from '@lat.md/core/lattice-model';
import type { ViewSearchResponse } from './protocol.js';
export type ViewSearch = (query: string) => Promise<ViewSearchResponse>;
export type ViewSearchDependencies = {
    runIndex: (latDir: string) => Promise<void>;
    runSearch: (latDir: string, query: string, limit: number, options: {
        buildIndex: false;
    }) => Promise<{
        query: string;
        matches: SectionMatch[];
    }>;
};
/** Create the lazily indexed semantic search service used by `lat ui`. */
export declare function createViewSearch(latDir: string, dependencies?: ViewSearchDependencies, getGeneration?: () => number, options?: {
    cacheDir?: string;
    preindexed?: boolean;
    sections?: readonly Section[];
    documentPaths?: ReadonlyMap<string, string>;
}): ViewSearch;
