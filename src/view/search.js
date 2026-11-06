import { viewSearchResult } from './search-result.js';
const VIEW_SEARCH_LIMIT = 10;
function defaultDependencies(cacheDir, sectionById) {
    return {
        async runIndex(latDir) {
            const { runIndex } = await import('../cli/search.js');
            await runIndex(latDir, undefined, undefined, { cacheDir });
        },
        async runSearch(latDir, query, limit, options) {
            const { runSearch } = await import('../cli/search.js');
            return runSearch(latDir, query, limit, undefined, {
                ...options,
                cacheDir,
                sectionById,
            });
        },
    };
}
/** Create the lazily indexed semantic search service used by `lat ui`. */
export function createViewSearch(latDir, dependencies, getGeneration = () => 0, options = {}) {
    const sectionById = options.sections
        ? new Map(options.sections.map((section) => [section.id.toLowerCase(), section]))
        : undefined;
    const resolvedDependencies = dependencies ?? defaultDependencies(options.cacheDir, sectionById);
    let indexReady = null;
    let indexedGeneration = options.preindexed ? getGeneration() : -1;
    const prepareIndex = async () => {
        while (indexedGeneration < getGeneration() || indexedGeneration < 0) {
            if (!indexReady) {
                const generation = getGeneration();
                indexReady = resolvedDependencies
                    .runIndex(latDir)
                    .then(() => {
                    indexedGeneration = Math.max(indexedGeneration, generation);
                })
                    .finally(() => {
                    indexReady = null;
                });
            }
            await indexReady;
        }
    };
    return async (rawQuery) => {
        const query = rawQuery.trim();
        if (!query)
            return { query: '', results: [] };
        await prepareIndex();
        const search = await resolvedDependencies.runSearch(latDir, query, VIEW_SEARCH_LIMIT, { buildIndex: false });
        return {
            query: search.query,
            results: search.matches.map((match) => viewSearchResult(latDir, match, options.documentPaths)),
        };
    };
}
