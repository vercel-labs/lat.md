import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

/** The persistent file must never be unlinked: all writers lock the same inode. */
export async function acquireSearchLock(
  cacheDir: string,
  timeoutMs = 120_000,
): Promise<() => Promise<void>> {
  const { tryLock } = await import('fs-native-extensions');
  const handle = await open(join(cacheDir, 'search-write.lock'), 'a+');
  const deadline = performance.now() + timeoutMs;
  try {
    while (!tryLock(handle.fd)) {
      const remaining = deadline - performance.now();
      if (remaining <= 0)
        throw new Error('Search index writer is busy; retry shortly.');
      await setTimeout(Math.min(100, remaining));
    }
    // Closing releases the kernel lock, including on abnormal process exit.
    return () => handle.close();
  } catch (error) {
    await handle.close();
    throw error;
  }
}
