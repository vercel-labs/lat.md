/**
 * Embedding replay server with two modes:
 *
 * - **Replay** (default): serves cached vectors from replay-data/
 * - **Capture** (_LAT_TEST_CAPTURE_EMBEDDINGS=1): proxies to real API,
 *   records all text→vector mappings, writes replay-data/ on close
 *
 * Both modes expose an OpenAI-compatible POST /embeddings endpoint.
 */
import { type Server } from 'node:http';
import type { RemoteProvider } from '@lat.md/embed';
type ReplayServerResult = {
    server: Server;
    port: number;
    url: string;
    /** Call to flush captured data (capture mode only) */
    flush: () => void;
};
export declare function startReplayServer(replayDir: string, opts?: {
    capture: true;
    provider: RemoteProvider;
    key: string;
}): Promise<ReplayServerResult>;
export declare function hasReplayData(replayDir: string): boolean;
export {};
