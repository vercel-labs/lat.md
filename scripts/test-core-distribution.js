import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'lat-core-package-'));
const consumer = join(scratch, 'consumer with spaces');
const fixture = join(scratch, 'project with spaces');
const cli = join(consumer, 'node_modules/@lat.md/core/dist/cli/index.js');
function run(command, args, cwd = root, expected = 0) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(
    result.status,
    expected,
    `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout + result.stderr;
}
function pnpm(args, cwd) {
  assert.ok(process.env.npm_execpath, 'Run this test through pnpm test:core');
  return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
}
function pack(path, out) {
  mkdirSync(out, { recursive: true });
  pnpm(['pack', '--pack-destination', out], path);
  return join(
    out,
    readdirSync(out).find((name) => name.endsWith('.tgz')),
  );
}
before(() => {
  mkdirSync(consumer);
  const tar = pack(join(root, 'packages/core'), join(scratch, 'core-tar'));
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: { '@lat.md/core': `file:${tar}` },
    }),
  );
  pnpm(
    [
      'install',
      '--prod',
      '--ignore-scripts',
      '--config.node-linker=hoisted',
      '--registry=https://registry.npmjs.org',
    ],
    consumer,
  );
  mkdirSync(join(fixture, 'lat.md'), { recursive: true });
  writeFileSync(
    join(fixture, 'lat.md/lat.md'),
    '# Project\n\nWorking documentation.\n',
  );
});
after(() =>
  rmSync(scratch, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  }),
);

// @lat: [[tests/distribution-tests#Core installs independently]]
test('packed core exposes only core commands without heavy dependencies', () => {
  const help = run(process.execPath, [cli, '--help']);
  assert.match(help, /Usage: lat-core/);
  for (const name of [
    'check',
    'locate',
    'section',
    'refs',
    'expand',
    'external',
    'paths',
  ])
    assert.match(help, new RegExp(`\\n  ${name}[ \\[]`));
  assert.doesNotMatch(help, /\n  config[ \[]/);
  assert.equal(
    run(process.execPath, [cli, 'paths', '--config']),
    run(process.execPath, [cli, 'config']),
  );
  for (const name of ['search', 'reindex', 'ui', 'init', 'hook', 'mcp'])
    assert.doesNotMatch(help, new RegExp(`\\n  ${name}[ \\[]`));
  for (const name of [
    '@tursodatabase/database',
    '@lat.md/embed',
    '@lat.md/embed-minilm-fp16',
    '@lat.md/server',
    '@lat.md/stemmer',
    'fs-native-extensions',
    'express',
    '@modelcontextprotocol/sdk',
  ])
    assert.equal(existsSync(join(consumer, 'node_modules', name)), false, name);
  assert.ok(
    existsSync(
      join(
        consumer,
        'node_modules/.bin',
        process.platform === 'win32' ? 'lat-core.cmd' : 'lat-core',
      ),
    ),
  );
  assert.match(
    run(process.execPath, [cli, 'check'], fixture),
    /All checks passed/,
  );
  const navigation = run(
    process.execPath,
    [cli, 'section', 'Project'],
    fixture,
  );
  assert.match(navigation, /lat-core section/);
  assert.match(navigation, /lat-core locate/);
  assert.doesNotMatch(navigation, /lat search/);
  run(process.execPath, [cli, '--dir', fixture, 'check', '--', 'lat.md']);
  writeFileSync(
    join(fixture, 'lat.md/lat.md'),
    '# Project\n\nBroken [[Missing]].\n',
  );
  assert.match(run(process.execPath, [cli, 'check'], fixture, 1), /Missing/);
  writeFileSync(
    join(fixture, 'lat.md/lat.md'),
    '# Project\n\nWorking documentation.\n',
  );
});

// @lat: [[tests/distribution-tests#Core ships parser and worker assets]]
test('packed core runs worker analysis, all source grammars, and external parsers', () => {
  const check = `
import assert from 'node:assert/strict';
import { analyzeMarkdownProject } from '@lat.md/core/project-analysis';
import { SOURCE_FILE_EXTENSIONS } from '@lat.md/core/source-formats';
import { resolveSourceSymbol } from '@lat.md/core/source-parser';
import { analyzeExternalDocument } from '@lat.md/core/external-documents';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = ${JSON.stringify(fixture)};
const result = await analyzeMarkdownProject(join(dir, 'lat.md'), dir, { executor: 'workers', cache: false });
assert.ok(result);
for (const extension of SOURCE_FILE_EXTENSIONS) {
 const path = join(dir, 'empty' + extension);
 writeFileSync(path, '');
 const parsed = await resolveSourceSymbol('empty' + extension, 'missing', dir);
 assert.equal(parsed.error, undefined, extension);
}
for (const [name, content] of [['guide.rst', 'Title\\n=====\\n\\nBody.\\n'], ['guide.adoc', '= Title\\n\\nBody.\\n']]) {
 const result = await analyzeExternalDocument(name, content);
 assert.ok(result.sections.length > 0);
}
`;
  writeFileSync(join(consumer, 'assets.mjs'), check);
  run(process.execPath, ['assets.mjs'], consumer);
});

// @lat: [[tests/distribution-tests#Full and core installations agree]]
test(
  'full and combined packed installs share validation and have distinct binaries',
  { skip: process.env.LAT_TEST_FULL_PACKAGE !== '1' },
  () => {
    const overrides = {};
    for (const dir of [
      'core',
      'embed',
      'embed-minilm-fp16',
      'server',
      'stemmer',
    ]) {
      const manifest = JSON.parse(
        readFileSync(join(root, 'packages', dir, 'package.json')),
      );
      overrides[manifest.name] =
        `file:${pack(join(root, 'packages', dir), join(scratch, `full-${dir}`))}`;
    }
    const fullTar = pack(root, join(scratch, 'full-tar'));
    const fullConsumer = join(scratch, 'full consumer');
    mkdirSync(fullConsumer);
    const manifest = {
      private: true,
      dependencies: { 'lat.md': `file:${fullTar}` },
      pnpm: { overrides },
    };
    for (const combined of [false, true]) {
      if (combined)
        manifest.dependencies['@lat.md/core'] = overrides['@lat.md/core'];
      writeFileSync(
        join(fullConsumer, 'package.json'),
        JSON.stringify(manifest),
      );
      pnpm(
        [
          'install',
          // This consumer intentionally adds core after its first installation.
          '--no-frozen-lockfile',
          '--prod',
          '--ignore-scripts',
          '--config.node-linker=hoisted',
          '--registry=https://registry.npmjs.org',
        ],
        fullConsumer,
      );
      const fullCli = join(
        fullConsumer,
        'node_modules/lat.md/dist/src/cli/index.js',
      );
      assert.match(run(process.execPath, [fullCli, '--help']), /search/);
      assert.equal(
        run(process.execPath, [fullCli, 'check'], fixture).replace(
          /in \d+ms/,
          'in TIME',
        ),
        run(process.execPath, [cli, 'check'], fixture).replace(
          /in \d+ms/,
          'in TIME',
        ),
      );
      assert.ok(
        existsSync(
          join(
            fullConsumer,
            'node_modules/.bin',
            process.platform === 'win32' ? 'lat.cmd' : 'lat',
          ),
        ),
      );
      if (combined)
        assert.ok(
          existsSync(
            join(
              fullConsumer,
              'node_modules/.bin',
              process.platform === 'win32' ? 'lat-core.cmd' : 'lat-core',
            ),
          ),
        );
    }
  },
);
