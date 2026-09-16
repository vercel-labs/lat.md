import { readFile, writeFile } from 'node:fs/promises';

// Bootstrap without installed dependencies. Keep exact resolutions and integrity
// hashes, but expose only core as an importer to a non-workspace pnpm install.
const lock = await readFile(
  new URL('../pnpm-lock.yaml', import.meta.url),
  'utf8',
);
const importer = lock.match(
  /^  packages\/core:\n([\s\S]*?)(?=^  \S|^packages:)/m,
);
const imports = lock.indexOf('\nimporters:\n');
const packages = lock.indexOf('\npackages:\n');
if (!importer || imports < 0 || packages < 0)
  throw new Error('Unsupported workspace lockfile layout');
const standalone =
  lock.slice(0, imports) +
  '\nimporters:\n\n  .:\n' +
  importer[1].trimEnd() +
  '\n' +
  lock.slice(packages);
await writeFile(
  new URL('../packages/core/pnpm-lock.yaml', import.meta.url),
  standalone,
);
