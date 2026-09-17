import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { acquireSearchLock, withSearchAccess } from './lock.js';
import {
  SearchDb,
  hasIndex,
  INDEX_FILE,
  ensureMeta,
  getStoredModel,
} from './db.js';

/** Retry transient Windows handles without deleting the usable index first. */
async function withFileRetry(work: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await work();
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows may briefly retain a staging handle or a reader handle.
      if (
        process.platform !== 'win32' ||
        attempt >= 9 ||
        !['EBUSY', 'EPERM', 'EACCES'].includes(code ?? '')
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

async function removeStaging(path: string): Promise<void> {
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    await withFileRetry(() => rm(path + suffix, { force: true }));
}

/** Build a private staging database; access locks protect copies and publication of search.db. */
export async function writeIndex<T>(
  latDir: string,
  cacheDir: string | undefined,
  rebuild: boolean,
  work: (db: SearchDb, storedModel: string | null) => Promise<T>,
): Promise<T> {
  const dir = cacheDir ?? join(latDir, '.cache');
  await mkdir(dir, { recursive: true });
  const path = join(dir, '_search.db');
  const activePath = join(dir, INDEX_FILE);
  let db: SearchDb | undefined;
  const release = await acquireSearchLock(dir);
  try {
    // A crashed writer may have left a partial database and journal behind.
    await removeStaging(path);
    const existing = hasIndex(dir);
    if (existing && !rebuild) {
      await withSearchAccess(dir, 'exclusive', async () => {
        // Recover/checkpoint a WAL left by a process that died during a query.
        const source = new SearchDb(activePath);
        try {
          await source.checkpoint();
        } finally {
          await source.close();
        }
        await copyFile(activePath, path);
      });
    }
    db = new SearchDb(path);
    const model = existing && !rebuild ? await getStoredModel(db) : null;
    await ensureMeta(db);
    const changesBefore = (await db.execute('SELECT total_changes() AS n'))
      .rows[0].n;
    const result = await work(db, model);
    const unchanged =
      existing &&
      !rebuild &&
      (await db.execute('SELECT total_changes() AS n')).rows[0].n ===
        changesBefore;
    await db.checkpoint();
    await db.close();
    db = undefined;
    if (!unchanged)
      await withSearchAccess(dir, 'exclusive', async () => {
        // Recover old sidecars before replacing their database, including after a crash.
        if (existing) {
          const wal = await stat(activePath + '-wal').catch(
            (error: NodeJS.ErrnoException) => {
              if (error.code !== 'ENOENT') throw error;
              return undefined;
            },
          );
          // A fresh rebuild must also repair an unreadable database with no WAL.
          if (wal && wal.size > 0) {
            const source = new SearchDb(activePath);
            try {
              await source.checkpoint();
            } finally {
              await source.close();
            }
          }
          for (const suffix of ['-wal', '-shm', '-journal'])
            await withFileRetry(() => rm(activePath + suffix, { force: true }));
        }
        await withFileRetry(() => rename(path, activePath));
      });
    return result;
  } finally {
    try {
      await db?.close();
    } finally {
      try {
        await removeStaging(path);
      } finally {
        await release();
      }
    }
  }
}
