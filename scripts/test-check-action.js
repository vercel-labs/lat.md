import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
