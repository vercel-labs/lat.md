import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { acquireSearchLock } from '../src/search/lock.js';
import { writeIndex } from '../src/search/cache.js';
import { SearchDb } from '../src/search/db.js';
import { rmDirBestEffort } from './util.js';

const dirs: string[] = [];
const children: ChildProcess[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'lat-lock-'));
  dirs.push(dir);
  return dir;
}
function writer(dir: string, mode = 'lock', timeout = 5000) {
  const child = fork(
    new URL('./support/search-writer.mjs', import.meta.url),
    [dir, mode, String(timeout)],
    { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] },
  );
  children.push(child);
  const messages: unknown[] = [];
  child.on('message', (message) => messages.push(message));
  const exited = once(child, 'exit');
  return {
    child,
    messages,
    exited,
    async wait(message: unknown) {
      await vi.waitFor(() => expect(messages).toContainEqual(message), {
        timeout: 10000,
      });
    },
  };
}
afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
    }),
  );
  for (const dir of dirs.splice(0)) rmDirBestEffort(dir);
});

// @lat: [[tests/search#Hybrid Retrieval#Ignores lock file contents]]
it('acquires empty or obsolete PID files without replacing the lock inode', async () => {
  const dir = fixture();
  for (const contents of ['', '{', JSON.stringify({ pid: process.pid })]) {
    writeFileSync(join(dir, 'search-write.lock'), contents);
    const inode = statSync(join(dir, 'search-write.lock')).ino;
    const release = await acquireSearchLock(dir, 0);
    try {
      await expect(acquireSearchLock(dir, 0)).rejects.toThrow('writer is busy');
    } finally {
      await release();
    }
    expect(readFileSync(join(dir, 'search-write.lock'), 'utf8')).toBe(contents);
    expect(statSync(join(dir, 'search-write.lock')).ino).toBe(inode);
    const next = await acquireSearchLock(dir, 0);
    await next();
    expect(existsSync(join(dir, 'search-write.lock'))).toBe(true);
  }
});

// @lat: [[tests/search#Hybrid Retrieval#Never steals a live writer lock]]
it('times out behind a live process and can acquire after that process releases', async () => {
  const dir = fixture();
  const owner = writer(dir);
  await owner.wait('acquired');
  const contender = writer(dir, 'lock', 200);
  await contender.wait({
    error: 'Search index writer is busy; retry shortly.',
  });
  expect(await contender.exited).toEqual([1, null]);
  expect(contender.messages).not.toContain('acquired');
  owner.child.send('release');
  await owner.wait('done');
  await owner.exited;
  const next = writer(dir);
  await next.wait('acquired');
  next.child.send('release');
  await next.wait('done');
});

// @lat: [[tests/search#Hybrid Retrieval#Recovers from a killed writer]]
it('preserves publication after SIGKILL and serializes waiting replacement writers', async () => {
  const dir = fixture();
  await writeIndex(dir, dir, true, async (db) => {
    await db.execute('CREATE TABLE crash_test (value TEXT)');
    await db.execute("INSERT INTO crash_test VALUES ('original')");
  });
  const before = readFileSync(join(dir, 'search.db'));
  const owner = writer(dir, 'index');
  await owner.wait('acquired');
  const contenders = [writer(dir, 'index'), writer(dir, 'index')];
  await Promise.all(contenders.map((c) => c.wait('started')));
  expect(contenders.every((c) => !c.messages.includes('acquired'))).toBe(true);
  owner.child.kill('SIGKILL');
  await owner.exited;
  expect(readFileSync(join(dir, 'search.db'))).toEqual(before);
  await vi.waitFor(
    () =>
      expect(
        contenders.filter((c) => c.messages.includes('acquired')),
      ).toHaveLength(1),
    { timeout: 10000 },
  );
  const first = contenders.find((c) => c.messages.includes('acquired'))!;
  const second = contenders.find((c) => c !== first)!;
  // A further process must time out while the winning replacement holds the lock.
  const probe = writer(dir, 'lock', 200);
  await probe.wait({ error: 'Search index writer is busy; retry shortly.' });
  expect(second.messages).not.toContain('acquired');
  expect(readFileSync(join(dir, 'search.db'))).toEqual(before);
  first.child.send('release');
  await first.wait('done');
  await second.wait('acquired');
  second.child.send('release');
  await second.wait('done');
  await Promise.all(contenders.map((c) => c.exited));
  expect(readdirSync(dir).sort()).toEqual(['search-write.lock', 'search.db']);
  const db = new SearchDb(join(dir, 'search.db'), true);
  try {
    expect((await db.execute('SELECT value FROM crash_test')).rows).toEqual([
      { value: 'replacement' },
    ]);
  } finally {
    await db.close();
  }
});
