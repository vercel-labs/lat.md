import { join } from 'node:path';
import { acquireFileLock, type LockMode } from '../file-lock.js';

export type { LockMode } from '../file-lock.js';

export function acquireSearchLock(cacheDir: string, timeoutMs = 120_000) {
  return acquireFileLock(
    join(cacheDir, 'search-write.lock'),
    'exclusive',
    performance.now() + timeoutMs,
    'Search index writer is busy; retry shortly.',
  );
}

/** A turnstile prevents new readers bypassing a writer waiting for readers to drain. */
export async function acquireSearchAccess(
  cacheDir: string,
  mode: LockMode,
  timeoutMs = 120_000,
): Promise<() => Promise<void>> {
  const deadline = performance.now() + timeoutMs;
  const message = 'Search database is busy; retry shortly.';
  const releaseGate = await acquireFileLock(
    join(cacheDir, 'search-access-gate.lock'),
    'exclusive',
    deadline,
    message,
  );
  try {
    return await acquireFileLock(
      join(cacheDir, 'search-access.lock'),
      mode,
      deadline,
      message,
    );
  } finally {
    await releaseGate();
  }
}

export async function withSearchAccess<T>(
  cacheDir: string,
  mode: LockMode,
  work: () => Promise<T>,
): Promise<T> {
  const release = await acquireSearchAccess(cacheDir, mode);
  try {
    return await work();
  } finally {
    await release();
  }
}
