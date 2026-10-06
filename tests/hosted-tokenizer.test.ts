import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

// @lat: [[tests/search#Hybrid Retrieval#Bundles only the hosted encoding]]
it('runs the standalone hosted bundle with identical upstream token counts', async () => {
  const require = createRequire(
    new URL('../packages/embed/package.json', import.meta.url),
  );
  const { getEncoding } = require('js-tiktoken');
  const reference = getEncoding('cl100k_base');
  const dir = await mkdtemp(join(tmpdir(), 'lat-tokenizer-'));
  try {
    const file = join(dir, 'remote.mjs');
    await copyFile(
      new URL('../packages/embed/dist/remote.js', import.meta.url),
      file,
    );
    const { createRemoteEmbedder } = await import(pathToFileURL(file).href);
    const embedder = createRemoteEmbedder('sk-test');
    expect(embedder.tokenizerFingerprint).toBe('cl100k_base:v1');
    for (const text of [
      '',
      'Hello, world!',
      '你好世界 🌍 café',
      'const answer = 42;\n',
      '<|endoftext|>',
      'token '.repeat(9000),
    ]) {
      expect(embedder.countTokens(text)).toBe(
        reference.encode(text, [], []).length,
      );
    }
    await expect(embedder.embed(['token '.repeat(9000)])).rejects.toThrow(
      'token limit',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
