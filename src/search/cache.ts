import { copyFile, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SearchDb,
  hasIndex,
  INDEX_FILE,
  ensureMeta,
  getStoredModel,
} from './db.js';

/** Cross-process writer lock; a crashed owner's lock can be reclaimed. */
async function lock(cacheDir: string): Promise<() => Promise<void>> {
  const path = join(cacheDir, 'search-write.lock');
  const deadline = Date.now() + 120000;
  while (true) {
    try {
      const handle = await open(path, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      await handle.close();
      return async () => {
        await rm(path, { force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const { pid } = JSON.parse(await readFile(path, 'utf8'));
        if (Number.isInteger(pid) && pid > 0) {
          try {
            process.kill(pid, 0);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
              await rm(path, { force: true });
              continue;
            }
          }
        }
      } catch {
        /* Owner may still be writing the lock. */
      }
      if (Date.now() > deadline)
        throw new Error('Search index writer is busy; retry shortly.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/** Retry transient Windows handles without deleting the usable index first. */
async function withFileRetry(work: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await work();
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows may briefly retain a staging handle or a reader's copy handle.
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

/** Build a private staging database; readers only open snapshots of search.db. */
export async function writeIndex<T>(
  latDir: string,
  cacheDir: string | undefined,
  rebuild: boolean,
  work: (db: SearchDb, storedModel: string | null) => Promise<T>,
): Promise<T> {
  const dir = cacheDir ?? join(latDir, '.cache');
  await mkdir(dir, { recursive: true });
  const release = await lock(dir);
  const path = join(dir, '_search.db');
  const activePath = join(dir, INDEX_FILE);
  let db: SearchDb | undefined;
  try {
    // A crashed writer may have left a partial database and journal behind.
    await removeStaging(path);
    const existing = hasIndex(dir);
    if (existing && !rebuild) await copyFile(activePath, path);
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
    if (!unchanged) await withFileRetry(() => rename(path, activePath));
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
