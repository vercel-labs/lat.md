import { once } from 'node:events';
import { writeIndex } from '../../dist/src/search/cache.js';
import { acquireSearchLock } from '../../dist/src/search/lock.js';

const [dir, mode, timeout] = process.argv.slice(2);
process.send('started');
try {
  if (mode === 'lock') {
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
