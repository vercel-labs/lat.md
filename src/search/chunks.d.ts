import type { SourceSpan } from './types.js';
import type { Embedder } from './embedder.js';
import type { MarkdownFileAnalysis } from '@lat.md/core/markdown-analysis';
import type { Section } from '@lat.md/core/lattice-model';
export declare const CHUNK_POLICY = "owned-blocks-v1";
export type Passage = {
    id: string;
    sectionId: string;
    ordinal: number;
    type: string;
    spans: SourceSpan[];
    text: string;
    input: string;
    inputHash: string;
    heading: string;
    path: string;
};
export declare const digest: (text: string) => string;
export declare function embeddingFingerprint(embedder: Embedder): string;
/** Find a fitting Unicode-safe prefix without assuming token-count monotonicity. */
export declare function fittingPrefix(text: string, fits: (text: string) => boolean): number;
/** Every body block is owned once; headings provide context instead of copied subtrees. */
export declare function chunkFile(file: MarkdownFileAnalysis, sections: readonly Section[], embedder: Embedder): Passage[];
