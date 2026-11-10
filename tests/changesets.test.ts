import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Repository automation scripts are plain Node ESM.
import { checkChangesets } from '../scripts/check-changesets.mjs';
// @ts-expect-error Repository automation scripts are plain Node ESM.
import { syncChangelog } from '../scripts/sync-changelog.mjs';

const cli = createRequire(import.meta.url).resolve('@changesets/cli/bin.js');
const roots: string[] = [];
const config = readFileSync(resolve('.changeset/config.json'), 'utf8');
const history =
  '# Changelog\n\nRelease history.\n\n## 0.1.0\n\nInitial release.\n';

function fixture(pending = false) {
  const root = mkdtempSync(join(tmpdir(), 'lat-changesets-'));
  roots.push(root);
  const write = (path: string, text: string) =>
    writeFileSync(join(root, path), text);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  mkdirSync(join(root, '.changeset'));
  mkdirSync(join(root, 'packages/core'), { recursive: true });
  write('pnpm-workspace.yaml', "packages:\n  - '.'\n  - 'packages/*'\n");
  write(
    'package.json',
    JSON.stringify({
      name: 'lat.md',
      version: '0.1.0',
      private: false,
      packageManager: 'pnpm@10.30.2',
      dependencies: { '@lat.md/core': 'workspace:*' },
    }),
  );
  write(
    'packages/core/package.json',
    JSON.stringify({ name: '@lat.md/core', version: '0.1.0' }),
  );
  write('.changeset/config.json', config);
  write('source.js', 'original\n');
  if (pending)
    write(
      '.changeset/pending.md',
      '---\n"@lat.md/core": patch\n---\n\nFix core behavior.\n',
    );
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  return { root, write, git, base };
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

// @lat: [[lat.md/knowledge/dev-process#Dev Process#Testing#Release automation tests]]
describe('Changesets release workflow', () => {
  it('requires a new fragment even when main already has a pending changeset', () => {
    const { root, write, base } = fixture(true);
    write('source.js', 'changed\n');
    expect(() => checkChangesets(base, root)).toThrow('Add a new changeset');
    write('.changeset/new.md', '---\n"lat.md": minor\n---\n\nAdd a feature.\n');
    expect(checkChangesets(base, root)).toBe('New changeset found.');
  });

  it('accepts an explicit no-release decision but requires an explanation', () => {
    const { root, write, base } = fixture();
    write('.changeset/docs.md', '---\n---\n');
    expect(() => checkChangesets(base, root)).toThrow('explain why');
    write(
      '.changeset/docs.md',
      '---\n---\n\nDocumentation only; no package release.\n',
    );
    expect(checkChangesets(base, root)).toBe('New changeset found.');
  });

  it('rejects malformed bump types', () => {
    const { root, write, base } = fixture();
    write('.changeset/new.md', '---\n"lat.md": small\n---\n\nFix a bug.\n');
    expect(() => checkChangesets(base, root)).toThrow('patch, minor, or major');
  });

  it('validates package names through the actual Changesets CLI', () => {
    const { root, write, base } = fixture();
    write(
      '.changeset/new.md',
      '---\n"missing-package": patch\n---\n\nFix a bug.\n',
    );
    expect(() =>
      execFileSync(
        process.execPath,
        [resolve('scripts/check-changesets.mjs'), base],
        { cwd: root, stdio: 'pipe' },
      ),
    ).toThrow();
  });

  it('versions core and its exact workspace dependent and permits the release PR', () => {
    const { root, write, git, base } = fixture(true);
    execFileSync(process.execPath, [cli, 'version'], {
      cwd: root,
      stdio: 'pipe',
    });
    const read = (path: string) => readFileSync(join(root, path), 'utf8');
    expect(JSON.parse(read('packages/core/package.json')).version).toBe(
      '0.1.1',
    );
    expect(JSON.parse(read('package.json')).version).toBe('0.1.1');
    expect(JSON.parse(read('package.json')).dependencies['@lat.md/core']).toBe(
      'workspace:*',
    );
    git('add', '.');
    expect(checkChangesets(base, root)).toBe(
      'Release-only changes consume existing changesets.',
    );
    const publicNotes = syncChangelog(read('CHANGELOG.md'), history);
    expect(publicNotes).toContain('## 0.1.1\n\nChanges included in Lat 0.1.1.');
    expect(publicNotes).toContain(
      '### Patch Changes\n\nFixes and dependency updates',
    );
    expect(publicNotes).toContain('## 0.1.0\n\nInitial release.');
    expect(syncChangelog(read('CHANGELOG.md'), publicNotes)).toBe(publicNotes);
    write('source.js', 'sneaked into release\n');
    expect(() => checkChangesets(base, root)).toThrow('Add a new changeset');
  });

  it('does not allow discarding a pending release without bumping its package', () => {
    const { root, base } = fixture(true);
    rmSync(join(root, '.changeset/pending.md'));
    expect(() => checkChangesets(base, root)).toThrow(
      'requires a version bump',
    );
  });

  it('preserves history when only empty changesets are consumed', () => {
    expect(syncChangelog('# lat.md\n', history)).toBe(history);
  });
});
