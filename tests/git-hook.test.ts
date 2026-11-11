import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { isAgentCommit } from '../src/cli/git-hook.js';
import {
  installGitHook,
  supportsConfiguredHooks,
} from '../src/cli/git-hook-install.js';
import { writeExperiments } from '../src/cli/experiments.js';
import { removeLatStopHooks, syncLatHooks } from '../src/cli/init.js';

const gitVersion = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const exec: typeof actual.execFileSync = (...args: unknown[]) => {
    if (
      args[0] === 'git' &&
      Array.isArray(args[1]) &&
      args[1][0] === '--version' &&
      gitVersion.value !== undefined
    )
      return gitVersion.value;
    return Reflect.apply(actual.execFileSync, undefined, args);
  };
  return { ...actual, execFileSync: exec };
});
const nativeConfiguredHooks = supportsConfiguredHooks(
  execFileSync('git', ['--version'], { encoding: 'utf8' }),
);

const directories: string[] = [];
const cli = join(import.meta.dirname, '../src/cli/index.ts');
const loader = pathToFileURL(
  join(import.meta.dirname, '../node_modules/tsx/dist/loader.mjs'),
).href;
const invocation = {
  command: process.execPath,
  args: ['--import', loader, cli],
};
const agentKeys = [
  'AI_AGENT',
  'CURSOR_TRACE_ID',
  'CURSOR_AGENT',
  'CURSOR_EXTENSION_HOST_ROLE',
  'GEMINI_CLI',
  'CODEX_SANDBOX',
  'CODEX_CI',
  'CODEX_THREAD_ID',
  'ANTIGRAVITY_AGENT',
  'AUGMENT_AGENT',
  'OPENCODE',
  'OPENCODE_CLIENT',
  'CLAUDECODE',
  'CLAUDE_CODE',
  'CLAUDE_CODE_IS_COWORK',
  'CLAUDE_CODE_CHILD_SESSION',
  'REPL_ID',
  'COPILOT_MODEL',
  'COPILOT_ALLOW_ALL',
  'COPILOT_GITHUB_TOKEN',
];
const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !agentKeys.includes(key) &&
        !key.startsWith('GIT_') &&
        key !== 'LAT_BYPASS_COMMIT_HOOK',
    ),
  );
const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnv(),
    stdio: 'pipe',
  });
function temporary(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lat git hook '));
  directories.push(dir);
  return dir;
}
function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function repo(): string {
  const root = temporary();
  git(root, '-c', 'init.templateDir=', 'init', '-q');
  git(root, 'config', 'user.name', 'Lat tests');
  git(root, 'config', 'user.email', 'lat@example.invalid');
  write(
    root,
    'lat.md/lat.md',
    '# Project\n\nA project with [[src/feature.ts#feature]].\n',
  );
  write(root, 'lat.md/.gitignore', '.cache/\n');
  writeExperiments(root, { 'commit-hooks': true });
  write(root, 'src/feature.ts', 'export function feature() { return 1; }\n');
  git(root, 'add', '.');
  return root;
}
function hook(root: string, extra: Record<string, string> = {}, agent = true) {
  return spawnSync(
    invocation.command,
    [...invocation.args, 'hook', 'git-pre-commit'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...cleanEnv(),
        ...(agent ? { AI_AGENT: 'codex' } : {}),
        ...extra,
      },
    },
  );
}
afterEach(async () => {
  gitVersion.value = undefined;
  vi.unstubAllEnvs();
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
  // Synchronous Git/CLI calls can keep the worker busy for over a minute across
  // tests. Let Vitest receive reporting RPC replies between those calls.
  await setImmediate();
});

// @lat: [[tests/hook#Agent detection protects manual commits]]
it('uses the package while excluding broad Claude IDE markers', async () => {
  for (const key of agentKeys) vi.stubEnv(key, '');
  expect(await isAgentCommit()).toBe(false);
  vi.stubEnv('CLAUDECODE', '1');
  expect(await isAgentCommit()).toBe(false);
  vi.stubEnv('CLAUDE_CODE_CHILD_SESSION', '1');
  expect(await isAgentCommit()).toBe(true);
  vi.stubEnv('CLAUDE_CODE_CHILD_SESSION', '');
  vi.stubEnv('AI_AGENT', 'claude');
  expect(await isAgentCommit()).toBe(true);
  vi.stubEnv('AI_AGENT', '');
  vi.stubEnv('CODEX_THREAD_ID', 'test');
  expect(await isAgentCommit()).toBe(true);
  const root = repo();
  write(root, 'lat.md/lat.md', '# Broken\n\n[[missing]]\n');
  git(root, 'add', '.');
  const result = hook(root, {}, false);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout + result.stderr).toBe('');
});

// @lat: [[tests/hook#Validates the index without touching work]]
it('checks staged content in an initial commit and preserves partial staging', () => {
  const root = repo();
  write(root, 'lat.md/lat.md', '# Broken\n\n[[missing]]\n');
  const indexBefore = readFileSync(join(root, '.git/index'));
  const workBefore = readFileSync(join(root, 'lat.md/lat.md'));
  const good = hook(root);
  expect(good.status, good.stderr).toBe(0);
  expect(good.stdout + good.stderr).toBe('');
  expect(readFileSync(join(root, '.git/index'))).toEqual(indexBefore);
  expect(readFileSync(join(root, 'lat.md/lat.md'))).toEqual(workBefore);
  git(root, 'add', 'lat.md/lat.md');
  write(root, 'lat.md/lat.md', '# Fixed\n\nFixed only in the working tree.\n');
  const bad = hook(root);
  expect(bad.status).toBe(1);
  expect(bad.stderr).toContain('missing');
  expect(bad.stderr).toContain('stage the fixes');
});

// @lat: [[tests/hook#Uses Git commit indexes]]
it.each(['staged', 'working-tree'])(
  'validates commit-all and path-specific commits in %s mode',
  (validation) => {
    const root = repo();
    const config = `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n---\n`;
    write(
      root,
      'lat.md/lat.md',
      config + '# Project\n\nA project with [[src/feature.ts#feature]].\n',
    );
    git(root, 'add', 'lat.md/lat.md');
    expect(installGitHook(root, invocation).status).toBe('installed');
    const commit = (...args: string[]) =>
      spawnSync('git', ['commit', '-qm', 'test', ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...cleanEnv(), AI_AGENT: 'codex' },
      });
    expect(commit().status).toBe(0);
    write(root, 'src/feature.ts', 'export function renamed() { return 1; }\n');
    expect(commit('-a').status).not.toBe(0);
    expect(commit('--', 'src/feature.ts').status).not.toBe(0);
    write(
      root,
      'lat.md/lat.md',
      config + '# Project\n\nA project with [[src/feature.ts#renamed]].\n',
    );
    const result = commit('-a');
    expect(result.status, result.stderr).toBe(0);
  },
);

// @lat: [[tests/hook#Working-tree validation resolves local targets]]
it.each(['staged', 'working-tree'])(
  'validates local checkout and untracked targets in %s mode',
  (validation) => {
    const root = repo();
    const config = `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n---\n`;
    write(root, '.git/info/exclude', 'vendor/\n');
    write(root, '.gitignore', '.pi/\n');
    write(
      root,
      'vendor/cpython/Python/runtime.c',
      'int run(void) { return 1; }\n',
    );
    git(join(root, 'vendor/cpython'), '-c', 'init.templateDir=', 'init', '-q');
    write(root, 'pyperformance/README.md', '# Local benchmark checkout\n');
    write(root, '.pi/notes.md', '# Local notes\n');
    write(
      root,
      'lat.md/lat.md',
      config +
        '# Project\n\nSee [[vendor/cpython/Python/runtime.c#run]], [[pyperformance/README.md]], and [[.pi/notes.md]].\n',
    );
    git(root, 'add', 'lat.md/lat.md', '.gitignore');
    const check = spawnSync(
      invocation.command,
      [...invocation.args, 'check', '--', 'lat.md'],
      {
        cwd: root,
        env: cleanEnv(),
        encoding: 'utf8',
      },
    );
    expect(check.status, check.stdout + check.stderr).toBe(0);
    const index = readFileSync(join(root, '.git/index'));
    const result = hook(root, { LAT_BYPASS_COMMIT_HOOK: '1' });
    expect(result.status, result.stderr).toBe(
      validation === 'working-tree' ? 0 : 1,
    );
    if (validation === 'staged') expect(result.stderr).toContain('runtime.c');
    expect(readFileSync(join(root, '.git/index'))).toEqual(index);
    expect(
      readFileSync(join(root, 'vendor/cpython/Python/runtime.c'), 'utf8'),
    ).toContain('int run');
  },
);

// @lat: [[tests/hook#Working-tree validation uses current file contents]]
it('accepts unstaged repairs and rejects unstaged errors without changing the index', () => {
  const root = repo();
  const config =
    '---\nlat:\n  git-pre-commit:\n    validation: working-tree\n---\n';
  write(
    root,
    'lat.md/lat.md',
    config + '# Project\n\nSee [[src/feature.ts#feature]].\n',
  );
  write(root, 'src/feature.ts', 'export function gone() {}\n');
  git(root, 'add', '.');
  // Tracked contents on disk, including repairs not yet staged, govern this mode.
  write(root, 'src/feature.ts', 'export function feature() {}\n');
  const index = readFileSync(join(root, '.git/index'));
  expect(hook(root).status).toBe(0);
  write(root, 'lat.md/lat.md', config + '# Broken\n\n[[missing]]\n');
  const result = hook(root, { LAT_BYPASS_COMMIT_HOOK: '1' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('working-tree validation failed');
  expect(result.stderr).toContain('missing');
  expect(readFileSync(join(root, '.git/index'))).toEqual(index);
});

// @lat: [[tests/hook#Validation mode comes from staged configuration]]
it('requires staging the validation choice and rejects invalid modes', () => {
  const root = repo();
  write(root, 'src/feature.ts', 'export function gone() {}\n');
  git(root, 'add', 'src/feature.ts');
  write(root, 'src/feature.ts', 'export function feature() {}\n');
  const config = (value: string) =>
    `---\nlat:\n  git-pre-commit:\n    validation: ${value}\n---\n# Project\n\nSee [[src/feature.ts#feature]].\n`;
  write(root, 'lat.md/lat.md', config('working-tree'));
  expect(hook(root).stderr).toContain('staged validation failed');
  git(root, 'add', 'lat.md/lat.md');
  // Unstaged config cannot change which data gets checked.
  write(root, 'lat.md/lat.md', config('staged'));
  const working = hook(root);
  expect(working.status, working.stderr).toBe(0);
  for (const invalid of ['disabled', 'false', 'null']) {
    write(root, 'lat.md/lat.md', config(invalid));
    git(root, 'add', 'lat.md/lat.md');
    const result = hook(root, { LAT_BYPASS_COMMIT_HOOK: '1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('validation');
  }
});

// @lat: [[tests/hook#Staged code review requires acknowledgment]]
it.each(['staged', 'working-tree'])(
  'stops a real initial commit for review in %s mode and allows an explicit retry',
  (validation) => {
    const root = repo();
    write(
      root,
      'src/feature.ts',
      'export function feature() {\n  const value = 1;\n  return value;\n}\n\n',
    );
    write(
      root,
      'lat.md/lat.md',
      `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n---\n# Project\n\nFeature behavior is documented here.\n` +
        '\n'.repeat(60),
    );
    git(root, 'add', '.');
    expect(installGitHook(root, invocation).status).toBe('installed');
    const commit = (bypass: string) =>
      spawnSync('git', ['commit', '-qm', 'initial'], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...cleanEnv(),
          AI_AGENT: 'codex',
          LAT_BYPASS_COMMIT_HOOK: bypass,
        },
      });
    const result = commit('');
    expect(result.status, result.stderr).toBe(1);
    expect(
      result.stderr.match(/IMPORTANT: lat precommit hook suggests/g),
    ).toHaveLength(1);
    expect(result.stderr).toContain('This commit was stopped for review.');
    expect(result.stderr).toContain('LAT_BYPASS_COMMIT_HOOK=1 git commit ...');
    expect(result.stderr).toContain('other Git hooks still run.\n\n\n');
    expect(() => git(root, 'rev-parse', '--verify', 'HEAD')).toThrow();
    expect(commit('0').status).toBe(1);
    expect(commit('true').status).toBe(1);
    const retry = commit('1');
    expect(retry.status, retry.stderr).toBe(0);
    expect(retry.stderr).not.toContain('IMPORTANT:');
    expect(git(root, 'status', '--porcelain')).toBe('');
  },
);

// @lat: [[tests/hook#Review bypass preserves validation and other hooks]]
it.each(['staged', 'working-tree'])(
  'keeps %s validation and other Git hooks active with the bypass flag',
  (validation) => {
    const root = repo();
    const config = `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n---\n`;
    expect(installGitHook(root, invocation).status).toBe('installed');
    const commit = () =>
      spawnSync('git', ['commit', '-qm', 'initial'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...cleanEnv(), AI_AGENT: 'codex', LAT_BYPASS_COMMIT_HOOK: '1' },
      });
    write(root, 'lat.md/lat.md', config + '# Broken\n\n[[missing]]\n');
    git(root, 'add', '.');
    const broken = commit();
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain(`${validation} validation failed`);
    write(
      root,
      'lat.md/lat.md',
      config + '# Project\n\nValid documentation.\n',
    );
    git(root, 'add', '.');
    const otherHook = join(root, '.git/hooks/commit-msg');
    writeFileSync(
      otherHook,
      '#!/bin/sh\necho "Other hook still runs" >&2\nexit 1\n',
    );
    chmodSync(otherHook, 0o755);
    const other = commit();
    expect(other.status).toBe(1);
    expect(other.stderr).toContain('Other hook still runs');
    expect(() => git(root, 'rev-parse', '--verify', 'HEAD')).toThrow();
  },
);

// @lat: [[tests/hook#Review reminders use only staged code churn]]
it('ignores unstaged work and documentation churn but counts staged deletions', () => {
  const root = repo();
  git(root, 'commit', '-qm', 'initial');
  const path =
    process.platform === 'win32'
      ? 'src/space é.ts'
      : 'src/space é\tline\nbreak.ts';
  const source = Array.from(
    { length: 5 },
    (_, n) => `export const value${n} = ${n};\n`,
  ).join('');
  write(root, path, source);
  write(root, 'lat.md/lat.md', '# Project\n\nUpdated documentation.\n');
  git(root, 'add', 'lat.md/lat.md');
  const docsOnly = hook(root);
  expect(docsOnly.status, docsOnly.stderr).toBe(0);
  expect(docsOnly.stdout + docsOnly.stderr).toBe('');
  git(root, 'add', path);
  const staged = hook(root);
  expect(staged.status, staged.stderr).toBe(1);
  expect(staged.stderr).toContain('IMPORTANT: lat precommit hook suggests');
  git(root, 'commit', '-qm', 'source');
  write(root, path, source.replace('= 0', '= 10'));
  git(root, 'add', path);
  // Extra unstaged churn cannot turn a two-line staged edit into a reminder.
  write(root, path, source + source.replaceAll('value', 'extra'));
  const small = hook(root);
  expect(small.status, small.stderr).toBe(0);
  expect(small.stdout + small.stderr).toBe('');
  git(root, 'rm', '-f', path);
  const deleted = hook(root);
  expect(deleted.status, deleted.stderr).toBe(1);
  expect(deleted.stderr).toContain('IMPORTANT: lat precommit hook suggests');
  write(root, 'lat.md/lat.md', '# Project\n\n[[missing]]\n');
  git(root, 'add', 'lat.md/lat.md');
  const broken = hook(root);
  expect(broken.status).toBe(1);
  expect(broken.stderr).not.toContain('IMPORTANT: lat precommit hook suggests');
  expect(broken.stderr).toContain('staged validation failed');
});

// @lat: [[tests/hook#Review reminders respect project scope]]
it('limits review suggestions to opted-in projects outside excluded subtrees', () => {
  const root = repo();
  write(
    root,
    'lat.md/lat.md',
    '---\nlat:\n  git-pre-commit:\n    exclude-projects:\n      - tests/cases\n---\n# Project\n\nA project.\n',
  );
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'initial');
  const source = 'export const value = 1;\n'.repeat(5);
  write(root, 'tests/cases/fixture.ts', source);
  git(root, 'add', '.');
  const excluded = hook(root);
  expect(excluded.status, excluded.stderr).toBe(0);
  expect(excluded.stdout + excluded.stderr).toBe('');
  writeExperiments(root, { 'commit-hooks': false });
  write(root, 'packages/app/lat.md/.gitignore', '.cache/\n');
  write(root, 'packages/app/lat.md/lat.md', '# App\n\nAn app.\n');
  writeExperiments(join(root, 'packages/app'), { 'commit-hooks': true });
  write(root, 'src/outside.ts', source);
  git(root, 'add', '.');
  const outside = hook(root);
  expect(outside.status, outside.stderr).toBe(0);
  expect(outside.stdout + outside.stderr).toBe('');
  write(root, 'packages/app/source.ts', source);
  git(root, 'add', '.');
  const inside = hook(root);
  expect(inside.status, inside.stderr).toBe(1);
  expect(
    inside.stderr.match(/IMPORTANT: lat precommit hook suggests/g),
  ).toHaveLength(1);
});

// @lat: [[tests/hook#Checks deletions and nested projects]]
it.each(['staged', 'working-tree'])(
  'checks nested projects and deletions in %s mode',
  (validation) => {
    const root = repo();
    write(
      root,
      'lat.md/lat.md',
      `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n---\n# Project\n\nSee [[src/feature.ts#feature]].\n`,
    );
    git(root, 'add', 'lat.md/lat.md');
    git(root, 'commit', '-qm', 'initial');
    write(
      root,
      'packages/app/lat.md/lat.md',
      '# App\n\nSee [[source.ts#run]].\n',
    );
    write(root, 'packages/app/lat.md/.gitignore', '.cache/\n');
    writeExperiments(join(root, 'packages/app'), { 'commit-hooks': true });
    write(root, 'packages/app/source.ts', 'export function run() {}\n');
    git(root, 'add', '.');
    expect(hook(root).status).toBe(0);
    git(root, 'commit', '-qm', 'nested');
    git(root, 'rm', 'packages/app/source.ts');
    const result = hook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packages/app');
    expect(result.stderr).toContain('source.ts');
  },
);

// @lat: [[tests/hook#Contains staged symlinks]]
it.skipIf(process.platform === 'win32')(
  'rejects staged escaping symlinks before validation',
  () => {
    const root = repo();
    symlinkSync(temporary(), join(root, 'outside'));
    git(root, 'add', 'outside');
    const result = hook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('symlink escapes');
  },
);

// @lat: [[tests/hook#Accepts contained symlinks under aliased temporary directories]]
it.skipIf(process.platform === 'win32')(
  'accepts internal symlinks when the temporary directory has a symlink ancestor',
  () => {
    const root = repo();
    const alias = join(temporary(), 'tmp');
    symlinkSync(temporary(), alias, 'dir');
    symlinkSync('feature.ts', join(root, 'src/alias.ts'));
    git(root, 'add', '.');
    const result = hook(root, { TMPDIR: alias });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
  },
);

// @lat: [[tests/hook#Excludes fixture projects using staged configuration]]
it.each(['staged', 'working-tree'])(
  'excludes fixtures without excluding sibling projects in %s mode',
  (validation) => {
    const root = repo();
    const original = readFileSync(join(root, 'lat.md/lat.md'), 'utf8');
    const configured =
      `---\nlat:\n  git-pre-commit:\n    validation: ${validation}\n    exclude-projects:\n      - tests/cases\n---\n` +
      original;
    write(root, 'tests/cases/broken/lat.md/.gitignore', '.cache/\n');
    writeExperiments(join(root, 'tests/cases/broken'), {
      'commit-hooks': true,
    });
    write(
      root,
      'tests/cases/broken/lat.md/lat.md',
      '# Fixture\n\n[[missing]]\n',
    );
    git(root, 'add', '.');
    write(root, 'lat.md/lat.md', configured);
    // Working-tree exclusions cannot hide a staged error.
    expect(hook(root).status).toBe(1);
    git(root, 'add', 'lat.md/lat.md');
    write(root, 'lat.md/lat.md', original);
    const excluded = hook(root);
    expect(excluded.status, excluded.stderr).toBe(0);
    // The similarly named sibling is still an independent validation target.
    write(root, 'tests/cases-other/lat.md/.gitignore', '.cache/\n');
    writeExperiments(join(root, 'tests/cases-other'), { 'commit-hooks': true });
    write(root, 'tests/cases-other/lat.md/lat.md', '# App\n\n[[missing]]\n');
    git(root, 'add', 'tests/cases-other');
    const sibling = hook(root);
    expect(sibling.status).toBe(1);
    expect(sibling.stderr).toContain('tests/cases-other');
    git(root, 'rm', '-rf', 'tests/cases-other');
    // Exclusions do not suppress validation of the owning root project.
    write(root, 'src/feature.ts', 'export function renamed() {}\n');
    git(root, 'add', 'src/feature.ts');
    const owning = hook(root);
    expect(owning.status).toBe(1);
    expect(owning.stderr).toContain('feature');
  },
);

// @lat: [[tests/hook#Rejects invalid project exclusions]]
it.each(['tests/cases', '["."]', '["../outside"]', '["/absolute"]'])(
  'rejects invalid project exclusion configuration: %s',
  (value) => {
    const root = repo();
    write(
      root,
      'lat.md/lat.md',
      `---\nlat:\n  git-pre-commit:\n    exclude-projects: ${value}\n---\n# Project\n\nValid content.\n`,
    );
    git(root, 'add', '.');
    const result = hook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exclude-projects');
  },
);

// @lat: [[tests/hook#Installs only owned Git hooks]]
it('installs and updates its hook without replacing custom or edited hooks', () => {
  gitVersion.value = 'git version 2.53.0';
  const root = repo();
  mkdirSync(join(root, 'nested'), { recursive: true });
  const path = join(root, '.git/hooks/pre-commit');
  expect(installGitHook(join(root, 'nested'), invocation).status).toBe(
    'installed',
  );
  expect(installGitHook(root, invocation).status).toBe('already configured');
  chmodSync(path, 0o644);
  expect(installGitHook(root, invocation).status).toBe(
    process.platform === 'win32' ? 'already configured' : 'installed',
  );
  expect(installGitHook(root, invocation).status).toBe('already configured');
  expect(
    installGitHook(root, { command: '/new/node', args: ['/new/lat.js'] })
      .status,
  ).toBe('installed');
  const custom = readFileSync(path, 'utf8') + '\necho custom\n';
  writeFileSync(path, custom);
  expect(installGitHook(root, invocation).status).toBe('integration required');
  expect(readFileSync(path, 'utf8')).toBe(custom);
  writeFileSync(path, '#!/usr/bin/python3\nraise SystemExit(17)\n');
  expect(installGitHook(root, invocation).status).toBe('integration required');
});

// @lat: [[tests/hook#Preserves hook managers and custom paths]]
it.each([
  '.husky/pre-commit',
  '.pre-commit-config.yaml',
  'lefthook.yml',
  'custom',
])('preserves %s', (path) => {
  gitVersion.value = 'git version 2.53.0';
  const root = repo();
  if (path === 'custom') git(root, 'config', 'core.hooksPath', temporary());
  else write(root, path, 'user configuration\n');
  const result = installGitHook(root, invocation);
  expect(result.status).toBe('integration required');
  expect(result.detail).toContain('lat hook git-pre-commit');
  expect(existsSync(join(root, '.git/hooks/pre-commit'))).toBe(false);
  if (path !== 'custom')
    expect(readFileSync(join(root, path), 'utf8')).toBe('user configuration\n');
});

// @lat: [[tests/hook#Detects configuration hook support]]
it.each([
  ['git version 2.53.9', false],
  ['git version 2.54.0', true],
  ['git version 2.54.0.windows.1', true],
  ['git version 2.54.0 (Apple Git-200)', true],
  ['git version 2.56.0', true],
  ['git version 3.0.0', true],
  ['unknown', false],
])('selects the installation format for %s', (version, configured) => {
  expect(supportsConfiguredHooks(version)).toBe(configured);
  gitVersion.value = version;
  const root = repo();
  expect(installGitHook(root, invocation).status).toBe('installed');
  expect(existsSync(join(root, '.git/hooks/pre-commit'))).toBe(!configured);
  expect(existsSync(join(root, '.git/hooks/lat-pre-commit'))).toBe(configured);
  if (configured)
    expect(
      git(root, 'config', '--local', '--get-all', 'hook.lat-md.event'),
    ).toBe('pre-commit\n');
});

// @lat: [[tests/hook#Migrates owned hooks to repository configuration]]
it('migrates only an unchanged launcher and refreshes configuration idempotently', () => {
  const root = repo();
  const legacy = join(root, '.git/hooks/pre-commit');
  const launcher = join(root, '.git/hooks/lat-pre-commit');
  gitVersion.value = 'git version 2.53.0';
  installGitHook(root, invocation);
  const owned = readFileSync(legacy, 'utf8');
  writeFileSync(legacy, owned + '\necho user edit\n');
  gitVersion.value = 'git version 2.54.0';
  expect(installGitHook(root, invocation).status).toBe('integration required');
  expect(readFileSync(legacy, 'utf8')).toBe(owned + '\necho user edit\n');
  expect(existsSync(launcher)).toBe(false);
  writeFileSync(legacy, owned);
  expect(installGitHook(root, invocation).status).toBe('installed');
  expect(existsSync(legacy)).toBe(false);
  expect(readFileSync(launcher, 'utf8')).toBe(owned);
  expect(installGitHook(root, invocation).status).toBe('already configured');
  expect(
    installGitHook(root, { command: '/new/node', args: ['/new/lat.js'] })
      .status,
  ).toBe('installed');
  expect(git(root, 'config', '--local', '--get-all', 'hook.lat-md.event')).toBe(
    'pre-commit\n',
  );
  const config = readFileSync(join(root, '.git/config'), 'utf8');
  writeFileSync(launcher, owned + '\necho custom launcher\n');
  expect(installGitHook(root, invocation).status).toBe('integration required');
  expect(readFileSync(join(root, '.git/config'), 'utf8')).toBe(config);
});

// @lat: [[tests/hook#Preserves configured hook overrides]]
it.each(['custom', 'disabled', 'global', 'duplicate', 'event-only'])(
  'preserves %s configuration instead of claiming it',
  (kind) => {
    gitVersion.value = 'git version 2.54.0';
    const root = repo();
    if (kind === 'disabled' || kind === 'duplicate')
      installGitHook(root, invocation);
    let configPath = join(root, '.git/config');
    if (kind === 'global') {
      configPath = join(temporary(), 'global-config');
      git(
        root,
        'config',
        '--file',
        configPath,
        'hook.lat-md.command',
        'echo global',
      );
      vi.stubEnv('GIT_CONFIG_GLOBAL', configPath);
    } else if (kind === 'disabled')
      git(root, 'config', 'hook.lat-md.enabled', 'false');
    else if (kind === 'duplicate')
      git(root, 'config', '--add', 'hook.lat-md.event', 'pre-push');
    else if (kind === 'event-only')
      git(root, 'config', 'hook.lat-md.event', 'pre-commit');
    else git(root, 'config', 'hook.lat-md.command', 'echo custom');
    const before = readFileSync(configPath, 'utf8');
    expect(installGitHook(root, invocation).status).toBe(
      'integration required',
    );
    expect(readFileSync(configPath, 'utf8')).toBe(before);
    expect(existsSync(join(root, '.git/hooks/pre-commit'))).toBe(false);
  },
);

// @lat: [[tests/hook#Configured hooks coexist with existing workflows]]
it.each([
  '.husky/pre-commit',
  '.pre-commit-config.yaml',
  'lefthook.yml',
  'custom',
])('adds a configured hook while preserving %s', (path) => {
  gitVersion.value = 'git version 2.54.0';
  const root = repo();
  const hooksPath =
    path === 'custom' ? join(root, 'custom hooks') : join(root, '.git/hooks');
  if (path === 'custom') git(root, 'config', 'core.hooksPath', hooksPath);
  else write(root, path, 'user configuration\n');
  mkdirSync(hooksPath, { recursive: true });
  const legacy = join(hooksPath, 'pre-commit');
  const script = '#!/bin/sh\necho existing-hook >&2\nexit 17\n';
  writeFileSync(legacy, script, { mode: 0o755 });
  git(root, 'config', 'hook.other.command', 'echo other-hook >&2');
  git(root, 'config', 'hook.other.event', 'pre-commit');
  expect(installGitHook(root, invocation).status).toBe('installed');
  expect(readFileSync(legacy, 'utf8')).toBe(script);
  expect(git(root, 'config', 'hook.other.command').trim()).toBe(
    'echo other-hook >&2',
  );
  if (path === 'custom')
    expect(git(root, 'config', 'core.hooksPath').trim()).toBe(hooksPath);
  else
    expect(readFileSync(join(root, path), 'utf8')).toBe('user configuration\n');
  if (nativeConfiguredHooks) {
    const listed = git(root, 'hook', 'list', '--show-scope', 'pre-commit');
    expect(listed).toContain('local\tlat-md');
    const result = spawnSync(
      'git',
      ['commit', '-qm', 'blocked by existing hook'],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...cleanEnv(), AI_AGENT: 'codex' },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('other-hook');
    expect(result.stderr).toContain('existing-hook');
  }
});

// @lat: [[tests/hook#Shares hooks across worktrees]]
it.each(nativeConfiguredHooks ? ['2.53.0', '2.54.0'] : ['2.53.0'])(
  'uses the active worktree with Git %s',
  (version) => {
    gitVersion.value = `git version ${version}`;
    const root = repo();
    git(root, 'commit', '-qm', 'initial');
    installGitHook(root, invocation);
    const worktree = join(temporary(), 'worktree');
    git(root, 'worktree', 'add', '-q', '-b', 'other', worktree);
    writeExperiments(worktree, { 'commit-hooks': true });
    writeExperiments(root, { 'commit-hooks': false });
    expect(installGitHook(worktree, invocation).status).toBe(
      'already configured',
    );
    write(worktree, 'src/feature.ts', 'export function gone() {}\n');
    git(worktree, 'add', '.');
    const result = spawnSync('git', ['commit', '-qm', 'broken'], {
      cwd: worktree,
      encoding: 'utf8',
      env: { ...cleanEnv(), AI_AGENT: 'codex' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('staged validation failed');
    expect(git(root, 'status', '--porcelain')).toBe('');
  },
);

// @lat: [[tests/hook#Recognizes aliased Git directories]]
it('recognizes its configured hook through a differently cased directory', ({
  skip,
}) => {
  gitVersion.value = 'git version 2.54.0';
  const root = repo();
  const alias = join(dirname(root), basename(root).toUpperCase());
  if (!existsSync(alias)) return skip(); // Requires a case-insensitive filesystem.
  expect(installGitHook(root, invocation).status).toBe('installed');
  const config = readFileSync(join(root, '.git/config'), 'utf8');
  const result = installGitHook(alias, invocation);
  expect(result.status, result.detail).toBe('already configured');
  expect(readFileSync(join(root, '.git/config'), 'utf8')).toBe(config);
});

// @lat: [[tests/hook#Migrates lifecycle hooks without collateral changes]]
it('removes Lat stop commands from mixed entries and preserves custom handlers', () => {
  const root = temporary();
  writeExperiments(root, { 'commit-hooks': true });
  const path = join(root, 'hooks.json');
  writeFileSync(
    path,
    JSON.stringify({
      description: 'keep',
      hooks: {
        Stop: [
          {
            matcher: 'any',
            hooks: [
              { type: 'command', command: 'lat hook codex Stop' },
              { type: 'command', command: 'echo lat' },
            ],
          },
        ],
      },
    }),
  );
  syncLatHooks(path, 'global', 'codex', root);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  expect(config.description).toBe('keep');
  expect(config.hooks.Stop).toEqual([
    { matcher: 'any', hooks: [{ type: 'command', command: 'echo lat' }] },
  ]);
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      hooks: {
        stop: [{ command: 'lat hook cursor stop' }, { command: 'custom-stop' }],
        beforeSubmitPrompt: [{ command: 'custom-prompt' }],
      },
    }),
  );
  removeLatStopHooks(path, root, true);
  expect(JSON.parse(readFileSync(path, 'utf8')).hooks).toEqual({
    stop: [{ command: 'custom-stop' }],
    beforeSubmitPrompt: [{ command: 'custom-prompt' }],
  });
});

// @lat: [[tests/hook#Missing runtime does not strand commits]]
it.skipIf(process.platform === 'win32')(
  'allows commits when the installed runtime disappears',
  () => {
    const root = repo();
    installGitHook(root, {
      command: '/missing/lat-node',
      args: ['/missing/lat.js'],
    });
    const result = spawnSync('git', ['commit', '-qm', 'manual'], {
      cwd: root,
      env: cleanEnv(),
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain('lat init');
  },
);

// @lat: [[tests/hook#Git validation requires explicit opt-in]]
it.each(['missing', 'disabled'])(
  'skips Git validation when experiment choices are %s',
  (state) => {
    const root = repo();
    if (state === 'missing')
      rmSync(join(root, 'lat.md/.cache/experiments.json'));
    else writeExperiments(root, { 'commit-hooks': false });
    write(root, 'lat.md/lat.md', '# Broken\n\n[[missing]]\n');
    git(root, 'add', '.');
    const result = hook(root);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
  },
);
