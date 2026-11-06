import { EmbeddingAuthError, type Embedder } from '@lat.md/embed';
export type { Embedder };
export { EmbeddingAuthError };
export type CreateSearchEngine = (key?: string) => Promise<Embedder>;
/** `meta.embedding_model` value for an embedder, e.g. `local:minilm-l6-v2:384`. */
export declare function modelKey(embedder: Embedder): string;
/** Thrown when the stored index can't be served by the current environment and
 *  a `lat reindex` is required (wrong/absent key, or model mismatch). */
export declare class ReindexRequiredError extends Error {
    constructor(message: string);
}
/** Build an embedder from the environment (key → remote, else local). Used for
 *  a fresh index and by `lat reindex` when re-deciding the backend. */
export declare function embedderFromEnv(): Promise<Embedder>;
/** Local (offline) embedder, ignoring any configured key. */
export declare function localEmbedder(): Promise<Embedder>;
/**
 * Resolve the embedder `lat search` must use, given the index's recorded model
 * and the repo dir. The stored model is authoritative — the env var never
 * silently flips the backend. A local index ignores the key; a remote index
 * requires a matching key (used to embed every query) or throws
 * {@link ReindexRequiredError}. On a fresh index (no stored model — e.g. the
 * regenerable `.cache` was wiped) the durable per-repo preference wins over the
 * env, so a repo switched to local stays local across cache loss.
 */
export declare function embedderForIndex(storedModel: string | null, latDir: string, createSearchEngine?: CreateSearchEngine): Promise<Embedder>;
