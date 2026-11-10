import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAgentCommit } from '../src/cli/git-hook.js';
import { installGitHook } from '../src/cli/git-hook-install.js';
import { removeLatStopHooks, syncLatHooks } from '../src/cli/init.js';

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
      ([key]) => !agentKeys.includes(key) && !key.startsWith('GIT_'),
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
      env: { ...cleanEnv(), ...(agent ? { AI_AGENT: 'codex' } : {}), ...extra },
    },
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
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
it('validates real git commit -a and path-specific temporary indexes', () => {
  const root = repo();
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
    '# Project\n\nA project with [[src/feature.ts#renamed]].\n',
  );
  const result = commit('-a');
  expect(result.status, result.stderr).toBe(0);
});

// @lat: [[tests/hook#Checks deletions and nested projects]]
it('finds staged nested projects and detects references to deleted source files', () => {
  const root = repo();
  git(root, 'commit', '-qm', 'initial');
  write(
    root,
    'packages/app/lat.md/lat.md',
    '# App\n\nSee [[source.ts#run]].\n',
  );
  write(root, 'packages/app/source.ts', 'export function run() {}\n');
  git(root, 'add', '.');
  expect(hook(root).status).toBe(0);
  git(root, 'commit', '-qm', 'nested');
  git(root, 'rm', 'packages/app/source.ts');
  const result = hook(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('packages/app');
  expect(result.stderr).toContain('source.ts');
});

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
it('excludes configured fixture subtrees without excluding sibling projects', () => {
  const root = repo();
  const original = readFileSync(join(root, 'lat.md/lat.md'), 'utf8');
  const configured =
    '---\nlat:\n  git-pre-commit:\n    exclude-projects:\n      - tests/cases\n---\n' +
    original;
  write(root, 'tests/cases/broken/lat.md/lat.md', '# Fixture\n\n[[missing]]\n');
  git(root, 'add', '.');
  write(root, 'lat.md/lat.md', configured);
  // Working-tree exclusions cannot hide a staged error.
  expect(hook(root).status).toBe(1);
  git(root, 'add', 'lat.md/lat.md');
  write(root, 'lat.md/lat.md', original);
  const excluded = hook(root);
  expect(excluded.status, excluded.stderr).toBe(0);
  // The similarly named sibling is still an independent validation target.
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
});

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
  const root = repo();
  mkdirSync(join(root, 'nested'), { recursive: true });
  const path = join(root, '.git/hooks/pre-commit');
  expect(installGitHook(join(root, 'nested'), invocation).status).toBe(
    'installed',
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

// @lat: [[tests/hook#Shares hooks across worktrees]]
it('uses the active worktree instead of capturing the installation directory', () => {
  const root = repo();
  git(root, 'commit', '-qm', 'initial');
  installGitHook(root, invocation);
  const worktree = join(temporary(), 'worktree');
  git(root, 'worktree', 'add', '-q', '-b', 'other', worktree);
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
});

// @lat: [[tests/hook#Migrates lifecycle hooks without collateral changes]]
it('removes Lat stop commands from mixed entries and preserves custom handlers', () => {
  const root = temporary();
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
