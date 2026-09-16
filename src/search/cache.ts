import { randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
  SearchDb,
  readManifest,
  INDEX_VERSION,
  MANIFEST_FILE,
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

/** Stage a complete generation; failed work cannot replace a usable index. */
export async function writeIndex<T>(
  latDir: string,
  cacheDir: string | undefined,
  rebuild: boolean,
  work: (db: SearchDb, storedModel: string | null) => Promise<T>,
): Promise<T> {
  const dir = cacheDir ?? join(latDir, '.cache');
  await mkdir(dir, { recursive: true });
  const release = await lock(dir);
  const name = `search-${randomUUID()}.db`,
    path = join(dir, name);
  let db: SearchDb | undefined;
  try {
    let manifest;
    try {
      manifest = readManifest(dir);
    } catch (error) {
      if (!rebuild) throw error;
      manifest = null;
    }
    let model: string | null = null;
    if (manifest) {
      const active = new SearchDb(
        join(dir, manifest.file),
        true,
        process.platform === 'win32',
      );
      try {
        model = await getStoredModel(active);
      } finally {
        await active.close();
      }
      if (!rebuild) await copyFile(join(dir, manifest.file), path);
    }
    // Staging has one writer and no readers. Multiprocess WAL can stall large
    // FTS builds; enable it only when opening published generations.
    db = new SearchDb(path, false);
    await ensureMeta(db);
    const changesBefore = (await db.execute('SELECT total_changes() AS n'))
      .rows[0].n;
    const result = await work(db, model);
    const unchanged =
      manifest &&
      !rebuild &&
      (await db.execute('SELECT total_changes() AS n')).rows[0].n ===
        changesBefore;
    await db.checkpoint();
    await db.close();
    db = undefined;
    if (unchanged) {
      for (const suffix of ['', '-wal', '-shm'])
        await rm(path + suffix, { force: true });
      return result;
    }
    const temp = join(dir, `${MANIFEST_FILE}.${randomUUID()}.tmp`);
    await writeFile(
      temp,
      JSON.stringify({ version: INDEX_VERSION, file: name }),
    );
    await rename(temp, join(dir, MANIFEST_FILE));
    return result;
  } catch (error) {
    await db?.close();
    for (const suffix of ['', '-wal', '-shm'])
      await rm(path + suffix, { force: true });
    throw error;
  } finally {
    await release();
  }
}
