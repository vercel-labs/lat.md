import type { CmdContext, CmdResult, Styler } from '@lat.md/core/context';
import { type IndexStats } from '../search/index.js';
import type { SectionMatch } from '@lat.md/core/lattice-model';
import type { Section } from '@lat.md/core/lattice-model';
import { type MarkdownProjectAnalysis } from '@lat.md/core/project-analysis';
export type SearchResult = {
    query: string;
    matches: SectionMatch[];
};
export type IndexProgress = {
    /** Called before indexing starts. `isEmpty` is true on first run. */
    beforeIndex?: (isEmpty: boolean) => void;
    /** Called after indexing completes with stats. */
    afterIndex?: (stats: IndexStats, isEmpty: boolean) => void;
};
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
export declare function runSearch(latDir: string, query: string, limit: number, progress?: IndexProgress, opts?: {
    buildIndex?: boolean;
    project?: MarkdownProjectAnalysis;
    sectionById?: ReadonlyMap<string, Section>;
    minSimilarity?: number;
    cacheDir?: string;
}): Promise<SearchResult>;
/**
 * Index-only mode (no query) — builds the index on first use. Rebuilding is
 * `lat reindex`, not a flag here.
 */
export declare function runIndex(latDir: string, progress?: IndexProgress, analyzedProject?: MarkdownProjectAnalysis, options?: {
    cacheDir?: string;
}): Promise<void>;
export declare function cliProgress(s: Styler): IndexProgress;
export declare function searchCommand(ctx: CmdContext, query: string | undefined, opts: {
    limit: number;
    debug?: boolean;
    minSimilarity?: number;
    preview?: 'passage' | 'intro' | 'both';
}, progress?: IndexProgress): Promise<CmdResult>;
