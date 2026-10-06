import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
// @lat: [[package-distribution#Dependency Boundary#Hosted tokenizer bundle]]
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/remote.ts'],
  outfile: join(root, 'dist/remote.js'),
  bundle: true,
  minify: true,
  treeShaking: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  legalComments: 'linked',
  metafile: true,
  write: false,
});
for (const output of Object.values(result.metafile.outputs)) {
  if (output.imports.some((dependency) => dependency.external))
    throw new Error('Hosted tokenizer bundle must be self-contained');
}
const tokenizerPackage = join(dirname(require.resolve('js-tiktoken')), '..');
const tokenizerRequire = createRequire(join(tokenizerPackage, 'package.json'));
const notices = [];
for (const directory of [
  tokenizerPackage,
  dirname(tokenizerRequire.resolve('base64-js/package.json')),
]) {
  const manifest = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  const license =
    manifest.name === 'js-tiktoken'
      ? join(root, 'licenses/js-tiktoken.txt') // Upstream npm tarball omits its MIT license.
      : join(directory, 'LICENSE');
  notices.push(
    `${manifest.name}@${manifest.version}\n${await readFile(license, 'utf8')}`,
  );
}
const files = [
  ...result.outputFiles,
  {
    path: join(root, 'dist/remote.NOTICES.txt'),
    contents: Buffer.from(notices.join('\n\n')),
  },
];
const gzipBytes = files.reduce(
  (sum, file) => sum + gzipSync(file.contents).length,
  0,
);
if (gzipBytes > 600 * 1024)
  throw new Error(`Hosted tokenizer exceeds 600 KiB gzip budget: ${gzipBytes}`);
for (const file of files) await writeFile(file.path, file.contents);
console.log(
  `Hosted tokenizer bundle: ${(gzipBytes / 1024).toFixed(1)} KiB gzip`,
);
