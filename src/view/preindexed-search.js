import { openIndexedSearchSession, resolveSearchMatches, } from '../search/query.js';
import { viewSearchResult } from './search-result.js';
const VIEW_SEARCH_LIMIT = 10;
/** Serve a built search index without importing indexing or Markdown parsers. */
export async function createPreindexedViewSearch(latDir, cacheDir, sections, documentPaths, dependencies = {
    openSearchSession: openIndexedSearchSession,
}, createSearchEngine) {
    const sectionById = new Map(sections.map((section) => [section.id.toLowerCase(), section]));
    const session = await dependencies.openSearchSession(latDir, {
        cacheDir,
        createSearchEngine,
    });
    const search = async (rawQuery) => {
        const query = rawQuery.trim();
        if (!query)
            return { query: '', results: [] };
        const results = await session.search(query, VIEW_SEARCH_LIMIT);
        return {
            query,
            results: resolveSearchMatches(results, sectionById).map((match) => viewSearchResult(latDir, match, documentPaths)),
        };
    };
    search.close = session.close;
    return search;
}
