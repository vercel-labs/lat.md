import { rmSync } from 'node:fs';

/**
 * Remove a temp dir, tolerating Windows file locks. Native databases can keep index files
 * locked briefly after `close()`, and a
 * just-executed `.cmd` shim can linger — Windows refuses to unlink either.
 * Retry with backoff, then give up quietly: a leftover dir under the OS temp
 * root is harmless on ephemeral CI runners, and cleanup is not under test.
 */
export function rmDirBestEffort(dir: string): void {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 150,
    });
  } catch {
    // Ignore EBUSY/EPERM/ENOTEMPTY — see doc comment.
  }
}
