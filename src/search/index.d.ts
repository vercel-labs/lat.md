import { type SearchDb } from './db.js';
import { type MarkdownProjectAnalysis } from '@lat.md/core/project-analysis';
import type { Embedder } from './embedder.js';
export declare function projectFingerprint(project: MarkdownProjectAnalysis): string;
export type IndexStats = {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
};
/** Exact identifier tokens complement FTS's punctuation and long-token handling. */
export declare function identifierTokens(text: string): string[];
export declare function indexSections(latDir: string, db: SearchDb, embedder: Embedder, onProgress?: (done: number, total: number) => void, analyzedProject?: MarkdownProjectAnalysis): Promise<IndexStats>;
