import { build } from 'esbuild';
import { createRequire, isBuiltin } from 'node:module';
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'dist/mermaid-runtime');
const jsdomLib = dirname(require.resolve('jsdom'));
const stylesheetPath = join(jsdomLib, 'jsdom/browser/default-stylesheet.css');
const stylesheet = await readFile(stylesheetPath, 'utf8');

// @lat: [[package-distribution#Dependency Boundary#Mermaid validation bundle]]
const result = await build({
  absWorkingDir: root,
  entryPoints: {
    worker: 'src/mermaid-worker.ts',
    // JSDOM resolves this worker at module initialization, even without XHR.
    'xhr-sync-worker': join(jsdomLib, 'jsdom/living/xhr/xhr-sync-worker.js'),
  },
  outdir,
  bundle: true,
  treeShaking: true,
  minify: true,
  splitting: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['canvas'], // Optional JSDOM renderer; text-only analysis never uses it.
  legalComments: 'linked',
  metafile: true,
  write: false,
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  plugins: [
    {
      name: 'inline-jsdom-stylesheet',
      setup(build) {
        build.onLoad(
          {
            filter:
              /[/\\]css-tree[/\\]lib[/\\](?:data(?:-patch)?|version)\.js$/,
          },
          async ({ path }) => {
            const source = await readFile(path, 'utf8');
            // Let esbuild resolve upstream JSON requires instead of runtime createRequire.
            return {
              contents: source
                .replace(/import \{ createRequire \} from 'module';\s*/, '')
                .replace(
                  /const require = createRequire\(import\.meta\.url\);\s*/,
                  '',
                ),
              loader: 'js',
              resolveDir: dirname(path),
            };
          },
        );
        build.onLoad(
          {
            filter:
              /[/\\]jsdom[/\\]living[/\\]css[/\\]helpers[/\\]computed-style\.js$/,
          },
          async ({ path }) => {
            const source = await readFile(path, 'utf8');
            const read =
              /fs\.readFileSync\(\s*path\.resolve\(__dirname, "\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css"\),\s*\{ encoding: "utf-8" \}\s*\)/g;
            // Package asset adaptation only: keep upstream parser/layout code intact.
            // Fail explicitly if a JSDOM update changes its resource-loading contract.
            if ([...source.matchAll(read)].length !== 1)
              throw new Error(
                'JSDOM stylesheet loader changed; update the bundle asset adapter',
              );
            return {
              contents: source.replace(read, () => JSON.stringify(stylesheet)),
              loader: 'js',
              resolveDir: dirname(path),
            };
          },
        );
      },
    },
  ],
});

// No installed JavaScript packages may be required by the generated runtime.
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (
      dependency.external &&
      dependency.path !== 'canvas' &&
      !isBuiltin(dependency.path)
    ) {
      throw new Error(
        `Unexpected runtime dependency in Mermaid bundle: ${dependency.path}`,
      );
    }
  }
}

// Preserve package licenses in addition to esbuild's linked legal comments.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules')) continue;
  let directory = dirname(resolve(root, input));
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      );
      if (!manifest.name) {
        directory = dirname(directory);
        continue;
      }
      packages.set(`${manifest.name}@${manifest.version}`, {
        directory,
        manifest,
      });
      break;
    } catch {
      directory = dirname(directory);
    }
  }
}
const notices = [];
for (const [name, { directory, manifest }] of [...packages].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  notices.push(
    `${name}\nLicense: ${manifest.license ?? 'See package license'}\n`,
  );
  for (const name of (await readdir(directory)).sort()) {
    if (/^(?:licen[cs]e|notice)(?:\.[^.]+)?$/i.test(name))
      notices.push(await readFile(join(directory, name), 'utf8'));
  }
}
const files = [
  ...result.outputFiles,
  {
    path: join(outdir, 'THIRD_PARTY_NOTICES.txt'),
    contents: Buffer.from(notices.join('\n\n')),
  },
];
const bytes = files.reduce((total, file) => total + file.contents.length, 0);
const gzipBytes = files.reduce(
  (total, file) => total + gzipSync(file.contents).length,
  0,
);
const gzipBudget = 3 * 1024 * 1024;
if (gzipBytes > gzipBudget)
  throw new Error(
    `Mermaid bundle exceeds 3 MiB gzip budget: ${gzipBytes} bytes`,
  );
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
for (const file of files) await writeFile(file.path, file.contents);
await writeFile(
  join(outdir, 'bundle-size.json'),
  JSON.stringify({ bytes, gzipBytes, gzipBudget }) + '\n',
);
// tsc checks the worker but only the self-contained build belongs in the package.
await rm(join(root, 'dist/mermaid-worker.js'), { force: true });
await rm(join(root, 'dist/mermaid-worker.d.ts'), { force: true });
console.log(
  `Mermaid validation bundle: ${(bytes / 1024 / 1024).toFixed(2)} MiB; ${(gzipBytes / 1024 / 1024).toFixed(2)} MiB gzip`,
);
