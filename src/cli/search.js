import { LEXICAL_VERSION } from '../search/lexical.js';
import { hasIndex } from '../search/db.js';
import { embeddingFingerprint } from '../search/chunks.js';
import { writeIndex } from '../search/cache.js';
import { dirname, join } from 'node:path';
import { openDb, setStoredModel, ensureSectionsSchema, closeDb, } from '../search/db.js';
import { embedderForIndex, modelKey, ReindexRequiredError, EmbeddingAuthError, } from '../search/embedder.js';
import { indexSections, projectFingerprint, } from '../search/index.js';
import { searchSections, prepareSearchQuery } from '../search/search.js';
import { indexMetadata, sameIndexMetadata, resolveSearchMatches, searchIndexedSections, } from '../search/query.js';
import { analyzeMarkdownProject, commandProjectAnalysis, } from '@lat.md/core/project-analysis';
import { formatResultList, formatNavHints } from '@lat.md/core/format';
async function withDb(latDir, progress, project, cacheDir, fn, prepare) {
    for (let attempt = 0; hasIndex(cacheDir ?? join(latDir, '.cache')); attempt++) {
        if (attempt >= 3)
            throw new Error('Search index keeps changing; retry shortly.');
        const metadataDb = openDb(latDir, cacheDir, true);
        let metadata;
        try {
            metadata = await indexMetadata(metadataDb);
        }
        finally {
            await closeDb(metadataDb);
        }
        const stored = metadata.get('embedding_model') ?? null;
        const embedder = await embedderForIndex(stored, latDir);
        if (metadata.get('fingerprint') !== embeddingFingerprint(embedder))
            throw new ReindexRequiredError('Search chunking or embedding model changed; run lat reindex.');
        if (!stored ||
            metadata.get('lexical_version') !== LEXICAL_VERSION ||
            metadata.get('project_hash') !== projectFingerprint(project))
            break;
        await prepare?.(embedder);
        const db = openDb(latDir, cacheDir, true);
        try {
            if (!sameIndexMetadata(metadata, await indexMetadata(db)))
                continue;
            progress?.afterIndex?.({
                added: 0,
                updated: 0,
                removed: 0,
                unchanged: project.sections.length,
            }, false);
            return await fn(db, embedder, project);
        }
        finally {
            await closeDb(db);
        }
    }
    return writeIndex(latDir, cacheDir, false, async (db, stored) => {
        const embedder = await embedderForIndex(stored, latDir);
        await ensureSectionsSchema(db, embedder.dimensions);
        const isEmpty = (await db.execute('SELECT COUNT(*) AS n FROM sections')).rows[0].n === 0;
        progress?.beforeIndex?.(isEmpty);
        const stats = await indexSections(latDir, db, embedder, undefined, project);
        await setStoredModel(db, modelKey(embedder));
        progress?.afterIndex?.(stats, isEmpty);
        await prepare?.(embedder);
        return fn(db, embedder, project);
    });
}
/**
 * Run a semantic search across lat.md sections.
 * Handles indexing (with optional progress callback). Returns matched sections.
 *
 * `opts.buildIndex: false` is read-only mode (the UserPromptSubmit hook): search
 * an existing index but never build or update it — so a user's first prompt in a
 * fresh repo isn't blocked by a full local embed pass. Building the index is
 * `lat search` / `lat reindex`. With nothing indexed yet, returns no matches
 * without even loading the embedder to embed the query.
 */
export async function runSearch(latDir, query, limit, progress, opts) {
    if (opts?.buildIndex === false) {
        const sectionById = opts.sectionById ??
            opts.project?.sectionById ??
            (await analyzeMarkdownProject(latDir, dirname(latDir), {
                executor: 'auto',
            })).sectionById;
        return searchIndexedSections(latDir, query, limit, sectionById, {
            cacheDir: opts.cacheDir,
            minSimilarity: opts.minSimilarity,
        });
    }
    const project = opts?.project ??
        (await analyzeMarkdownProject(latDir, dirname(latDir), {
            executor: 'auto',
        }));
    let vector;
    return withDb(latDir, progress, project, opts?.cacheDir, async (db, embedder, analyzed) => {
        const results = await searchSections(db, query, embedder, limit, opts?.minSimilarity, vector);
        return {
            query,
            matches: resolveSearchMatches(results, analyzed.sectionById),
        };
    }, async (embedder) => {
        vector = await prepareSearchQuery(query, embedder, limit, opts?.minSimilarity);
    });
}
/**
 * Index-only mode (no query) — builds the index on first use. Rebuilding is
 * `lat reindex`, not a flag here.
 */
export async function runIndex(latDir, progress, analyzedProject, options = {}) {
    const project = analyzedProject ??
        (await analyzeMarkdownProject(latDir, dirname(latDir), {
            executor: 'auto',
        }));
    await withDb(latDir, progress, project, options.cacheDir, async () => { });
}
export function cliProgress(s) {
    return {
        beforeIndex(isEmpty) {
            if (isEmpty) {
                process.stderr.write(s.dim('Building index...'));
            }
        },
        afterIndex(stats, isEmpty) {
            if (isEmpty) {
                process.stderr.write(s.dim(` done (${stats.added} added, ${stats.updated} updated, ${stats.removed} removed)\n`));
            }
            else if (stats.added + stats.updated + stats.removed > 0) {
                process.stderr.write(s.dim(`Index updated: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed\n`));
            }
        },
    };
}
export async function searchCommand(ctx, query, opts, progress) {
    const s = ctx.styler;
    try {
        if (!query) {
            await runIndex(ctx.latDir, progress, await commandProjectAnalysis(ctx));
            return { output: '' };
        }
        const project = await commandProjectAnalysis(ctx);
        const result = await runSearch(ctx.latDir, query, opts.limit, progress, {
            project,
            minSimilarity: opts.minSimilarity,
        });
        if (result.matches.length === 0) {
            return { output: 'No results found.' };
        }
        return {
            output: formatResultList(ctx, `Search results for "${query}":`, result.matches, { showScores: opts.debug, preview: opts.preview ?? 'passage' }) + formatNavHints(ctx),
        };
    }
    catch (err) {
        // The stored index can't be served in the current environment — never
        // switch backends silently; direct the user to `lat reindex`.
        if (err instanceof ReindexRequiredError) {
            return { output: s.red(err.message), isError: true };
        }
        if (err instanceof EmbeddingAuthError) {
            return {
                output: s.red(`LAT_LLM_KEY was rejected by the provider (${err.status}).`) +
                    ' Run ' +
                    s.cyan('lat reindex') +
                    ' to fix the key or switch to the local model.',
                isError: true,
            };
        }
        // Config/key resolution errors (e.g. empty LAT_LLM_KEY_FILE) or other
        // failures — surface the message rather than crashing.
        return { output: err.message, isError: true };
    }
}
