import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'lat-action-test-'));
const artifact = join(scratch, 'action');
cpSync(join(root, '.lat-build/check-action'), artifact, { recursive: true });
const workspace = join(scratch, 'workspace');
const project = join(workspace, 'project with spaces');
mkdirSync(join(project, 'lat.md'), { recursive: true });
after(() =>
  rmSync(scratch, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  }),
);
function action(extra = {}) {
  return spawnSync(process.execPath, [join(artifact, 'action/index.js')], {
    cwd: scratch,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: '',
      XDG_CACHE_HOME: join(scratch, 'user-cache'),
      GITHUB_WORKSPACE: workspace,
      'INPUT_WORKING-DIRECTORY': 'project with spaces',
      INPUT_PROFILE: 'false',
      ...extra,
    },
  });
}
// @lat: [[tests/distribution-tests#Action runs without installation]]
test('relocated action validates a subdirectory without project dependencies', () => {
  writeFileSync(
    join(project, 'lat.md/lat.md'),
    '# Project\n\nWorking documentation.\n',
  );
  const result = action({ INPUT_PROFILE: 'true' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Lat core/);
  assert.match(result.stdout, /All checks passed/);
  assert.equal(existsSync(join(workspace, 'node_modules')), false);
  const runtime = join(artifact, 'runtime');
  assert.equal(existsSync(join(runtime, 'node_modules/@lat.md/embed')), false);
  // Exercise binary assets and dynamic worker/module paths in the actual released runtime.
  const probe = join(scratch, 'probe.mjs');
  writeFileSync(
    probe,
    `
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const base = ${JSON.stringify(pathToFileURL(join(runtime, 'dist') + '/').href)};
const { analyzeMarkdownProject } = await import(new URL('project-analysis.js', base));
const { SOURCE_FILE_EXTENSIONS } = await import(new URL('source-formats.js', base));
const { resolveSourceSymbol } = await import(new URL('source-parser.js', base));
const { analyzeExternalDocument } = await import(new URL('external-documents.js', base));
const dir = ${JSON.stringify(project)};
await analyzeMarkdownProject(join(dir, 'lat.md'), dir, { executor: 'workers', cache: false });
for (const extension of SOURCE_FILE_EXTENSIONS) {
  writeFileSync(join(dir, 'empty' + extension), '');
  const parsed = await resolveSourceSymbol('empty' + extension, 'missing', dir);
  assert.equal(parsed.error, undefined, extension);
}
for (const [name, text] of [['guide.rst', 'Title\\n=====\\n\\nBody.\\n'], ['guide.adoc', '= Title\\n\\nBody.\\n']]) {
  const result = await analyzeExternalDocument(name, text);
  assert.ok(result.sections.length > 0);
}
`,
  );
  const assets = spawnSync(process.execPath, [probe], {
    cwd: scratch,
    encoding: 'utf8',
  });
  assert.equal(assets.status, 0, assets.stdout + assets.stderr);
});
// @lat: [[tests/distribution-tests#Action preserves validation failures]]
test('action fails the job for broken links and invalid inputs', () => {
  writeFileSync(
    join(project, 'lat.md/lat.md'),
    '# Project\n\nBroken [[Missing]].\n',
  );
  const result = action();
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Missing/);
  assert.equal(action({ INPUT_PROFILE: 'invalid' }).status, 1);
  assert.equal(
    action({ 'INPUT_WORKING-DIRECTORY': 'missing directory' }).status,
    1,
  );
});

// @lat: [[tests/distribution-tests#Action rejects cache symlinks]]
test('action rejects cache symlinks without changing outside files', () => {
  for (const [index, link] of [
    'lat.md',
    'lat.md/.cache',
    'lat.md/.cache/external',
    'lat.md/.cache/external/unused',
    'lat.md/.cache/external/unused.json',
    'lat.md/.cache/external/unused.json.lock',
    'lat.md/.cache/parsed',
    'lat.md/.cache/parsed/la',
  ].entries()) {
    const checkout = join(workspace, `symlink-${index}`);
    const victim = join(scratch, `victim-${index}`);
    mkdirSync(join(victim, 'unused'), { recursive: true });
    writeFileSync(join(victim, 'unused.json'), 'victim metadata');
    writeFileSync(join(victim, 'unused/keep.txt'), 'victim content');
    writeFileSync(
      join(victim, 'lat.md'),
      '# Project\n\nValid documentation.\n',
    );
    const linkPath = join(checkout, link);
    mkdirSync(dirname(linkPath), { recursive: true });
    symlinkSync(
      victim,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    if (link !== 'lat.md') {
      writeFileSync(
        join(checkout, 'lat.md/lat.md'),
        '# Project\n\nValid documentation.\n',
      );
    }
    if (
      link.startsWith('lat.md/.cache/external/') &&
      !link.endsWith('/unused.json')
    ) {
      writeFileSync(join(checkout, 'lat.md/.cache/external/unused.json'), '{}');
    }
    const before = readdirSync(victim, { recursive: true }).sort();
    const result = action({ 'INPUT_WORKING-DIRECTORY': `symlink-${index}` });
    assert.equal(result.status, 1, link + result.stdout + result.stderr);
    assert.match(
      result.stdout + result.stderr,
      /unsafe cache path.*symbolic link/,
    );
    assert.deepEqual(
      readdirSync(victim, { recursive: true }).sort(),
      before,
      link,
    );
    assert.equal(
      readFileSync(join(victim, 'unused.json'), 'utf8'),
      'victim metadata',
    );
    assert.equal(
      readFileSync(join(victim, 'unused/keep.txt'), 'utf8'),
      'victim content',
    );
  }
});

// @lat: [[tests/distribution-tests#Action ignores planted Git caches]]
test('action never opens Git configuration planted in the checkout', async () => {
  const server = createServer(
    {
      cert: readFileSync(
        join(root, 'tests/external-sources/fixtures/localhost-cert.pem'),
      ),
      key: readFileSync(
        join(root, 'tests/external-sources/fixtures/localhost-key.pem'),
      ),
    },
    (_request, response) => {
      response.writeHead(401, { 'www-authenticate': 'Basic realm="test"' });
      response.end('Authentication required');
    },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const checkout = join(workspace, 'planted-git');
    const cache = join(checkout, 'lat.md/.cache/external/upstream');
    const marker = join(scratch, 'credential-helper-ran');
    const commit = 'a'.repeat(40);
    const repo = `https://localhost:${server.address().port}/repo.git`;
    mkdirSync(dirname(cache), { recursive: true });
    const git = (...args) => {
      const result = spawnSync('git', args, { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    git('init', '--bare', '--template=', cache);
    git('-C', cache, 'remote', 'add', 'origin', repo);
    git('-C', cache, 'config', 'remote.origin.promisor', 'true');
    git('-C', cache, 'config', 'remote.origin.partialclonefilter', 'blob:none');
    git(
      '-C',
      cache,
      'config',
      'credential.helper',
      `!echo compromised > "${marker.replaceAll('\\', '/')}"`,
    );
    writeFileSync(
      cache + '.json',
      JSON.stringify({ ver: 1, source: repo, commit, strategy: 'checkout' }),
    );
    writeFileSync(
      join(checkout, 'lat.md/lat.md'),
      `---\nlat:\n  external-sources:\n    upstream:\n      repo: ${repo}\n      commit: ${commit}\n      strategy: checkout\n---\n# Project\n\nRead [[upstream:guide.md]].\n`,
    );
    const run = (command, args, env) =>
      new Promise((resolve, reject) => {
        const child = spawn(command, args, {
          cwd: scratch,
          env: { ...process.env, ...env },
        });
        let output = '';
        child.stdout.on('data', (data) => {
          output += data;
        });
        child.stderr.on('data', (data) => {
          output += data;
        });
        child.on('error', reject);
        child.on('close', (status) => resolve({ status, output }));
      });
    const env = {
      GIT_SSL_CAINFO: join(
        root,
        'tests/external-sources/fixtures/localhost-cert.pem',
      ),
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    };
    // Prove this fixture really executes its helper if a checker trusts the cache.
    await run('git', ['-C', cache, 'show', `${commit}:guide.md`], env);
    assert.equal(
      existsSync(marker),
      true,
      'malicious fixture did not execute its helper',
    );
    rmSync(marker);
    const result = await run(
      process.execPath,
      [join(artifact, 'action/index.js')],
      {
        ...env,
        XDG_CACHE_HOME: join(scratch, 'user-cache'),
        GITHUB_WORKSPACE: workspace,
        'INPUT_WORKING-DIRECTORY': 'planted-git',
        INPUT_PROFILE: 'false',
      },
    );
    assert.equal(result.status, 1, result.output);
    assert.equal(existsSync(marker), false, result.output);
    assert.match(
      result.output,
      /Authentication failed|could not read Username/,
    );
    assert.equal(
      existsSync(cache),
      false,
      'legacy cache should be removed without invoking Git',
    );
    const alias = join(scratch, 'cache-home-alias');
    symlinkSync(
      checkout,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    for (const cacheHome of [checkout, alias]) {
      const unsafeRoot = action({
        'INPUT_WORKING-DIRECTORY': 'planted-git',
        XDG_CACHE_HOME: cacheHome,
      });
      assert.equal(unsafeRoot.status, 1, unsafeRoot.stdout + unsafeRoot.stderr);
      assert.match(
        unsafeRoot.stdout + unsafeRoot.stderr,
        /managed Git cache must be outside the project/,
      );
      assert.equal(existsSync(marker), false);
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
