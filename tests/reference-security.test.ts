import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanCodeRefs } from '@lat.md/core/code-refs';
import { getSection } from '@lat.md/core/cli/section';
import { plainStyler } from '@lat.md/core/context';
import { resolveSourceSymbol } from '@lat.md/core/source-parser';
import { analyzeMarkdownFile } from '@lat.md/core/markdown-analysis';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), 'lat-reference-security-'));
  roots.push(parent);
  const root = join(parent, 'project');
  const latDir = join(root, 'lat.md');
  await mkdir(latDir, { recursive: true });
  return { parent, root, latDir };
}

// @lat: [[tests/section#Source reads stay inside the project]]
it('rejects parent traversal and symlinks before resolving or rendering source snippets', async () => {
  const { parent, root, latDir } = await fixture();
  await writeFile(
    join(parent, 'private.ts'),
    'export const token = "outside-secret";',
  );
  await symlink(join(parent, 'private.ts'), join(root, 'linked.ts'));
  await writeFile(join(root, 'safe.ts'), 'export const token = "public";');
  await writeFile(
    join(latDir, 'lat.md'),
    '# Project\n\nSee [[../private.ts#token]], [[linked.ts#token]], and [[safe.ts#token]].\n',
  );
  for (const path of ['../private.ts', 'linked.ts'])
    expect((await resolveSourceSymbol(path, 'token', root)).found).toBe(false);
  const section = await getSection(
    { projectRoot: root, latDir, styler: plainStyler, mode: 'cli' },
    'Project',
  );
  expect(JSON.stringify(section)).not.toContain('outside-secret');
  expect(section.kind).toBe('found');
  if (section.kind === 'found')
    expect(section.outgoingSourceRefs.map((ref) => ref.file)).toEqual([
      'safe.ts',
    ]);
});

// @lat: [[tests/check-code-refs#Unambiguous reference filenames]]
it.skipIf(process.platform === 'win32')(
  'keeps colon and newline filenames identical in rg and fallback scans',
  async () => {
    const { root, latDir } = await fixture();
    await writeFile(join(latDir, 'lat.md'), '# Project\n\nDocumentation.\n');
    await writeFile(join(root, '.env'), 'PRIVATE_BACKLINK');
    const names = ['.env:1:backlink.ts', 'line\nbreak.ts'];
    for (const name of names)
      await writeFile(
        join(root, name),
        `// @${'lat'}: [[lat.md/lat#Project]]\n`,
      );
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-C', root, 'add', '--', ...names, 'lat.md']);
    const original = process.env._LAT_DISABLE_RG;
    try {
      for (const disable of ['0', '1']) {
        process.env._LAT_DISABLE_RG = disable;
        const scan = await scanCodeRefs(root);
        expect(scan.refs.map((ref) => ref.file).sort()).toEqual(
          [...names].sort(),
        );
        const result = await getSection(
          { projectRoot: root, latDir, styler: plainStyler, mode: 'cli' },
          'Project',
        );
        expect(JSON.stringify(result)).not.toContain('PRIVATE_BACKLINK');
      }
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  },
);

// @lat: [[tests/section#Malformed index entries remain bounded]]
it('handles long unterminated aliases and preserves valid index targets', () => {
  const content =
    '# Index\n\nOverview.\n\n- [[valid|Alias]]\n- [[broken' +
    '|'.repeat(50_000);
  const result = analyzeMarkdownFile(
    '/project/lat.md/lat.md',
    content,
    '/project/lat.md',
    '/project',
  );
  expect(result.indexEntries).toEqual(['valid']);
}, 2_000);
