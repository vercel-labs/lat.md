/** Walk up from this file to find the nearest package.json version. */
export declare function getLocalVersion(): string;
/**
 * Fetch the latest published version of `lat.md` from the npm registry.
 * Returns null if the fetch fails or times out (3s).
 */
export declare function fetchLatestVersion(): Promise<string | null>;
