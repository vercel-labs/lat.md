export type LockMode = 'shared' | 'exclusive';
export declare function acquireSearchLock(cacheDir: string, timeoutMs?: number): Promise<() => Promise<void>>;
/** A turnstile prevents new readers bypassing a writer waiting for readers to drain. */
export declare function acquireSearchAccess(cacheDir: string, mode: LockMode, timeoutMs?: number): Promise<() => Promise<void>>;
export declare function withSearchAccess<T>(cacheDir: string, mode: LockMode, work: () => Promise<T>): Promise<T>;
