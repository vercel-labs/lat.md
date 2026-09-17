// Compare the pre-lock implementation at a Git ref with the current built code.
// Usage: node scripts/benchmark-search-access.mjs [baseline-ref] [passage-counts]
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  statSync,
  rmSync,
} from 'node:fs';
import { tmpdir, platform, arch, release } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { writeIndex } from '../dist/src/search/cache.js';
import { ensureSectionsSchema, setStoredModel } from '../dist/src/search/db.js';
import { indexSections } from '../dist/src/search/index.js';
import { openIndexedSearchSession } from '../dist/src/search/query.js';

const baseline = process.argv[2] ?? 'bc32a58';
const counts = (process.argv[3] ?? '1000,10000,50000').split(',').map(Number);
const root = mkdtempSync(join(tmpdir(), 'lat-search-benchmark-'));
const iterations = 15;
const vector = Array.from({ length: 384 }, (_, i) => Math.sin(i + 1));
const engine = {
  name: 'local:benchmark',
  dimensions: 384,
  maxInputTokens: 256,
  tokenizerFingerprint: 'benchmark-words-v1',
  countTokens: (text) => text.split(/\s+/).length,
  embed: async (texts) => texts.map(() => vector),
};
const results = {
  baseline,
  node: process.version,
  platform: `${platform()} ${arch()} ${release()}`,
  iterations,
  method:
    'Warm filesystem cache; alternating order; deterministic precomputed 384D embeddings; real FTS and exact vector scan. Session includes open, metadata, query and close. Persistent reuses one session. Decimal MB.',
  results: [],
};
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function stats(samples) {
  samples.sort((a, b) => a - b);
  return {
    medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2),
    p95Ms: +samples[Math.ceil(samples.length * 0.95) - 1].toFixed(2),
  };
}
try {
  const oldRoot = join(root, 'baseline');
  cpSync(resolve('dist/src'), join(oldRoot, 'src'), { recursive: true });
  writeFileSync(join(oldRoot, 'package.json'), '{"type":"module"}');
  symlinkSync(
    resolve('node_modules'),
    join(oldRoot, 'node_modules'),
    'junction',
  );
  for (const file of [
    'search/db',
    'search/query',
    'search/search',
    'search/lock',
    'search/cache',
    'cli/search',
  ]) {
    const source = execFileSync('git', ['show', `${baseline}:src/${file}.ts`], {
      encoding: 'utf8',
    });
    writeFileSync(
      join(oldRoot, 'src', `${file}.js`),
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      }).outputText,
    );
  }
  const old = (
    await import(pathToFileURL(join(oldRoot, 'src/search/query.js')).href)
  ).openIndexedSearchSession;
  for (const count of counts) {
    const lat = join(root, `case-${count}`, 'lat.md');
    mkdirSync(lat, { recursive: true });
    const words =
      'Documentation describes configuration authentication cache storage retrieval database permissions concurrency deployment testing performance operations. '.repeat(
        8,
      );
    let content = '# Guide\n\nBenchmark documentation.\n';
    for (let i = 0; i < count; i++)
      content += `\n## Topic ${i}\n\n${i % 100 === 0 ? 'needle ' : ''}Document ${i}. ${words}\n`;
    writeFileSync(join(lat, 'guide.md'), content);
    await writeIndex(lat, undefined, true, async (db) => {
      await ensureSectionsSchema(db, 384);
      await indexSections(lat, db, engine);
      await setStoredModel(db, 'local:benchmark:384');
    });
    const bytes = statSync(join(lat, '.cache', 'search.db')).size;
    const entry = { passages: count + 1, sizeMB: +(bytes / 1e6).toFixed(2) };
    for (const persistent of [false, true]) {
      const samples = { copy: [], lock: [] };
      const openers = { copy: old, lock: openIndexedSearchSession };
      const sessions = {};
      if (persistent)
        for (const mode of Object.keys(openers))
          sessions[mode] = await openers[mode](lat, {
            createSearchEngine: async () => engine,
          });
      try {
        for (let i = -2; i < iterations; i++) {
          let expected;
          for (const mode of i % 2 === 0
            ? ['copy', 'lock']
            : ['lock', 'copy']) {
            const start = performance.now();
            const session =
              sessions[mode] ??
              (await openers[mode](lat, {
                createSearchEngine: async () => engine,
              }));
            let matches;
            try {
              matches = await session.search('needle database', 5);
            } finally {
              if (!persistent) await session.close();
            }
            const elapsed = performance.now() - start;
            if (i >= 0) samples[mode].push(elapsed);
            const hash = digest(matches);
            if (expected && expected !== hash)
              throw new Error('Search results differ');
            expected = hash;
          }
        }
      } finally {
        for (const session of Object.values(sessions)) await session.close();
      }
      entry[persistent ? 'persistent' : 'session'] = {
        copy: stats(samples.copy),
        lock: stats(samples.lock),
      };
    }
    results.results.push(entry);
    console.error(JSON.stringify(entry));
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
