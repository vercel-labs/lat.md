import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  isExperimentEnabled,
  readExperiments,
  writeExperiments,
} from '../src/cli/experiments.js';
import {
  readAgentsTemplate,
  readCursorRulesTemplate,
  readOpenCodePluginTemplate,
  readPiExtensionTemplate,
} from '../src/cli/gen.js';
import { analyzeMarkdownFile } from '@lat.md/core/markdown-analysis';

const roots: string[] = [];
function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'lat-experiments-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

// @lat: [[tests/init#Experiment settings are local and reloadable]]
it('defaults off and reloads per-project choices while retaining unknown IDs', () => {
  const first = project();
  const second = project();
  expect(readExperiments(first)).toEqual({});
  expect(isExperimentEnabled('commit-hooks', first)).toBe(false);
  expect(isExperimentEnabled('commit-hooks', null)).toBe(false);
  writeExperiments(first, { 'commit-hooks': true, future: false });
  expect(isExperimentEnabled('commit-hooks', first)).toBe(true);
  expect(isExperimentEnabled('commit-hooks', second)).toBe(false);
  expect(readExperiments(first)).toEqual({
    'commit-hooks': true,
    future: false,
  });
  writeExperiments(first, { 'commit-hooks': false });
  expect(isExperimentEnabled('commit-hooks', first)).toBe(false);
  rmSync(join(first, 'lat.md/.cache/experiments.json'));
  expect(isExperimentEnabled('commit-hooks', first)).toBe(false);
});

// @lat: [[tests/init#Malformed experiment settings fail safely]]
it.each([
  '{',
  '{"version":2,"experiments":{}}',
  '{"version":1,"experiments":[]}',
  '{"version":1,"experiments":{"commit-hooks":"false"}}',
])(
  'rejects malformed experiment settings without overwriting them: %s',
  (content) => {
    const root = project();
    writeExperiments(root, {});
    const path = join(root, 'lat.md/.cache/experiments.json');
    writeFileSync(path, content);
    expect(() => readExperiments(root)).toThrow('experiments.json');
    expect(readFileSync(path, 'utf8')).toBe(content);
  },
);

// @lat: [[tests/init#Generated templates follow project experiments]]
it.each([false, true])(
  'selects valid templates for the explicit target project (commit-hooks=%s)',
  (enabled) => {
    const root = project();
    writeExperiments(root, { 'commit-hooks': enabled });
    for (const [name, content] of [
      ['AGENTS.md', readAgentsTemplate(root)],
      ['cursor-rules.md', readCursorRulesTemplate(root)],
    ]) {
      expect(content.includes('After EVERY task')).toBe(!enabled);
      expect(
        analyzeMarkdownFile(
          join(root, 'lat.md', name),
          content,
          join(root, 'lat.md'),
          root,
        ).diagnostics,
      ).toEqual([]);
    }
    expect(readPiExtensionTemplate(root).includes('agent_end')).toBe(!enabled);
    expect(readOpenCodePluginTemplate(root).includes('session.idle')).toBe(
      !enabled,
    );
  },
);

// @lat: [[tests/init#CLI generation honors the selected project]]
it('uses --dir project choices when generating instructions through the CLI', () => {
  const root = project();
  const other = project();
  writeExperiments(root, { 'commit-hooks': true });
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
  expect(result.stdout).toContain('Before committing');
  expect(result.stdout).not.toContain('After EVERY task');
});
