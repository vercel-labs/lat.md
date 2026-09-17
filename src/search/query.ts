import { LEXICAL_VERSION } from './lexical.js';
import { ReindexRequiredError } from './embedder.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hasIndex } from './db.js';
import type { Section, SectionMatch } from '@lat.md/core/lattice-model';
import { closeDb, openDb, type SearchDb } from './db.js';
import { embedderForIndex, type CreateSearchEngine } from './embedder.js';
import {
  searchSections,
  prepareSearchQuery,
  type SearchResult,
} from './search.js';

export type IndexedSearchResult = {
  query: string;
  matches: SectionMatch[];
};

export type IndexedSearchSession = {
  search: (
    query: string,
    limit: number,
    minSimilarity?: number,
  ) => Promise<SearchResult[]>;
  close: () => Promise<void>;
};

/** Resolve scored index rows against one already-analyzed project snapshot. */
export function resolveSearchMatches(
  results: readonly SearchResult[],
  sectionById: ReadonlyMap<string, Section>,
): SectionMatch[] {
  return results.flatMap((result) => {
    const section = sectionById.get(result.id.toLowerCase());
    return section
      ? [
          {
            section,
            reason: 'hybrid match',
            rankScore: result.rankScore,
            semanticSimilarity: result.semanticSimilarity,
            lexicalScore: result.lexicalScore,
            semanticRank: result.semanticRank,
            lexicalRank: result.lexicalRank,
            evidence: result.evidence,
            diagnostics: result.diagnostics,
          } satisfies SectionMatch,
        ]
      : [];
  });
}

/** Reuse an embedder with scoped database access for a sequence of index queries. */
export async function openIndexedSearchSession(
  latDir: string,
  options: {
    cacheDir?: string;
    createSearchEngine?: CreateSearchEngine;
  } = {},
): Promise<IndexedSearchSession> {
  const cacheDir = options.cacheDir ?? join(latDir, '.cache');
  if (!existsSync(cacheDir) || !hasIndex(cacheDir))
    return { search: async () => [], close: async () => {} };
  const readMetadata = async () => {
    const db = openDb(latDir, options.cacheDir, true);
    try {
      return await indexMetadata(db);
    } finally {
      await closeDb(db);
    }
  };
  const initial = await readMetadata();
  const stored = initial.get('embedding_model') ?? null;
  if (stored && initial.get('lexical_version') !== LEXICAL_VERSION)
    throw new ReindexRequiredError(
      'Search lexical index changed; run lat search to update it.',
    );
  const embedder = stored
    ? await embedderForIndex(stored, latDir, options.createSearchEngine)
    : null;
  let closed = false;
  const active = new Set<Promise<SearchResult[]>>();
  return {
    search(query, limit, minSimilarity) {
      if (closed) return Promise.reject(new Error('Search session is closed'));
      const operation = (async () => {
        if (!embedder) return [];
        const vector = await prepareSearchQuery(
          query,
          embedder,
          limit,
          minSimilarity,
        );
        const db = openDb(latDir, options.cacheDir, true);
        try {
          if (!sameIndexMetadata(initial, await indexMetadata(db)))
            throw new ReindexRequiredError(
              'Search index changed; reopen the search session to refresh its documents and model.',
            );
          return await searchSections(
            db,
            query,
            embedder,
            limit,
            minSimilarity,
            vector,
          );
        } finally {
          await closeDb(db);
        }
      })();
      active.add(operation);
      void operation.finally(() => active.delete(operation)).catch(() => {});
      return operation;
    },
    async close() {
      closed = true;
      await Promise.allSettled([...active]);
    },
  };
}

/** Query a finished index and resolve its ids from precomputed section data. */
export async function searchIndexedSections(
  latDir: string,
  query: string,
  limit: number,
  sectionById: ReadonlyMap<string, Section>,
  options: { cacheDir?: string; minSimilarity?: number } = {},
): Promise<IndexedSearchResult> {
  const session = await openIndexedSearchSession(latDir, options);
  try {
    const results = await session.search(query, limit, options.minSimilarity);
    return {
      query,
      matches: resolveSearchMatches(results, sectionById),
    };
  } finally {
    await session.close();
  }
}

export async function indexMetadata(
  db: SearchDb,
): Promise<Map<string, string>> {
  return new Map(
    (await db.execute('SELECT key,value FROM meta')).rows.map((row) => [
      row.key,
      row.value,
    ]),
  );
}
export function sameIndexMetadata(
  a: Map<string, string>,
  b: Map<string, string>,
): boolean {
  return (
    a.size === b.size && [...a].every(([key, value]) => b.get(key) === value)
  );
}
