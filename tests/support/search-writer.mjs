import { once } from 'node:events';
import { SearchDb } from '../../dist/src/search/db.js';
import { join } from 'node:path';
import { writeIndex } from '../../dist/src/search/cache.js';
import {
  acquireSearchLock,
  acquireSearchAccess,
} from '../../dist/src/search/lock.js';

const [dir, mode, timeout] = process.argv.slice(2);
process.send('started');
try {
  if (mode === 'shared' || mode === 'exclusive') {
    const release = await acquireSearchAccess(dir, mode, Number(timeout));
    try {
      process.send('acquired');
      await once(process, 'message');
    } finally {
      await release();
    }
  } else if (mode === 'reader') {
    const db = new SearchDb(join(dir, 'search.db'), true);
    try {
      await db.execute('SELECT * FROM crash_test');
      process.send('acquired');
      await once(process, 'message');
    } finally {
      await db.close();
    }
  } else if (mode === 'lock') {
    const release = await acquireSearchLock(dir, Number(timeout));
    process.send('acquired');
    await once(process, 'message');
    await release();
  } else {
    await writeIndex(dir, dir, true, async (db) => {
      await db.execute('CREATE TABLE crash_test (value TEXT)');
      await db.execute("INSERT INTO crash_test VALUES ('replacement')");
      process.send('acquired');
      await once(process, 'message');
    });
  }
  process.send('done');
  process.disconnect();
} catch (error) {
  process.send({ error: error.message });
  process.disconnect();
  process.exitCode = 1;
}
