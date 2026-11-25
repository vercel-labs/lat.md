import { open } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

export type LockMode = 'shared' | 'exclusive';

/** Lock files stay in place so every process locks the same inode. */
export async function acquireFileLock(
  path: string,
  mode: LockMode,
  deadline: number,
  message: string,
): Promise<() => Promise<void>> {
  const { tryLock } = await import('fs-native-extensions');
  const handle = await open(path, 'a+');
  try {
    while (!tryLock(handle.fd, { shared: mode === 'shared' })) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error(message);
      await setTimeout(Math.min(10, remaining));
    }
    return () => handle.close();
  } catch (error) {
    await handle.close();
    throw error;
  }
}
