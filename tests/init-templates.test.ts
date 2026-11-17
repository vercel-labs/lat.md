import { afterEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeInitMeta } from '@lat.md/core/init-version';
import {
  readAgentsTemplate,
  readCursorRulesTemplate,
  readOpenCodePluginTemplate,
  readPiExtensionTemplate,
} from '../src/cli/gen.js';
import { analyzeMarkdownFile } from '@lat.md/core/markdown-analysis';

const roots: string[] = [];
function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'lat-templates-'));
  roots.push(root);
  mkdirSync(join(root, 'lat.md'));
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

// @lat: [[tests/init#Instruction templates cover both workflows]]
it.each([true, false])(
  'provides valid instruction templates (gitHook=%s)',
  (gitHook) => {
    const root = project();
    for (const [name, content] of [
      ['AGENTS.md', readAgentsTemplate(gitHook)],
      ['cursor-rules.md', readCursorRulesTemplate(gitHook)],
    ]) {
      expect(content.includes('After EVERY task')).toBe(!gitHook);
      expect(content.includes('git-pre-commit')).toBe(gitHook);
      expect(
        analyzeMarkdownFile(
          join(root, 'lat.md', name),
          content,
          join(root, 'lat.md'),
          root,
        ).diagnostics,
      ).toEqual([]);
    }
    // Plugins take their workflow from a value injected by init.
    for (const template of [
      readPiExtensionTemplate(),
      readOpenCodePluginTemplate(),
    ])
      expect(template).toContain('__LAT_VALIDATION__');
  },
);

// @lat: [[tests/init#CLI generation honors the selected project]]
it.each(['commit', 'completion', 'manual', undefined] as const)(
  'generates instructions for the --dir project with a %s setup',
  (validation) => {
    const root = project();
    const other = project();
    if (validation) writeInitMeta(join(root, 'lat.md'), {}, validation);
    writeInitMeta(join(other, 'lat.md'), {}, 'completion');
    const cli = join(import.meta.dirname, '../src/cli/index.ts');
    const loader = pathToFileURL(
      join(import.meta.dirname, '../node_modules/tsx/dist/loader.mjs'),
    ).href;
    const result = spawnSync(
      process.execPath,
      ['--import', loader, cli, '--dir', root, 'gen', 'agents.md'],
      { cwd: other, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const gitHook = validation === undefined || validation === 'commit';
    expect(result.stdout.includes('Before committing')).toBe(gitHook);
    expect(result.stdout.includes('After EVERY task')).toBe(!gitHook);
  },
);
