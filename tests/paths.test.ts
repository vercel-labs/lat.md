import { afterEach, beforeEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let scratch: string;
let project: string;
let config: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'lat-paths-test-'));
  project = join(scratch, 'project');
  mkdirSync(join(project, 'lat.md'), { recursive: true });
  config = join(
    scratch,
    'config',
    // @folder/xdg preserves the lowercase style of this test's config home.
    ...(process.platform === 'win32' ? ['config'] : []),
    'lat',
    'config.json',
  );
  env = {
    ...process.env,
    XDG_CONFIG_HOME: join(scratch, 'config'),
    XDG_CACHE_HOME: join(scratch, 'cache'),
    LAT_LLM_KEY: '',
    LAT_LLM_KEY_FILE: join(scratch, 'key.txt'),
    LAT_LLM_KEY_HELPER: 'this-helper-must-never-be-executed',
  };
});
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

function run(core: boolean, args: string[], cwd = scratch): string {
  const cli = resolve(
    core ? 'packages/core/dist/cli/index.js' : 'dist/src/cli/index.js',
  );
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return result.stdout.trim();
}

// @lat: [[tests/config#Configuration#Storage information#Project paths without side effects]]
it('describes project storage without creating files or resolving credentials', () => {
  writeFileSync(
    join(project, 'lat.md/config.local.yaml'),
    'external-sources:\n  docs:\n    local-path: ../external tree\n',
  );
  mkdirSync(join(project, 'nested'));
  const before = readdirSync(scratch, { recursive: true }).sort();
  for (const core of [true, false]) {
    const help = run(core, ['--help']);
    expect(help).toMatch(/\n  paths[ \[]/);
    expect(help).not.toMatch(/\n  info[ \[]/);
    const output = run(core, ['--dir', join(project, 'nested'), 'paths']);
    expect(output).toMatch(/^# Paths\n\n## User\n\n- \*\*Config file:\*\*/);
    expect(output).toContain('## Project');
    expect(output).toContain('`' + config + '` (not found)');
    expect(output).toContain(join(scratch, 'key.txt'));
    expect(output).toContain(join(scratch, 'external tree'));
    expect(output).toContain('**Project Git cache:**');
    expect(output).toContain('external-checkouts-v1');
    expect(output).toContain(join(project, 'lat.md/.cache/parsed'));
    expect(output).not.toContain('## Temporary storage');
    expect(output).not.toContain('lat-external-ref-<random>');
    expect(output).not.toContain('lat-search-reader-');
    expect(output).not.toContain('Search reader snapshots');
    expect(output).not.toContain('lat-ui-search-');
    expect(output).not.toContain('Deployed UI search');
    if (core) {
      expect(output).not.toContain('**Search database:**');
    } else {
      expect(output).toContain(join(project, 'lat.md/.cache/search.db'));
      expect(output).toContain(
        join(project, 'lat.md/.cache/search-access.lock'),
      );
    }
  }
  expect(readdirSync(scratch, { recursive: true }).sort()).toEqual(before);
});

// @lat: [[tests/config#Configuration#Storage information#Configuration outside a project]]
it('supports config-only and legacy output outside a project without displaying secrets', () => {
  for (const core of [true, false]) {
    expect(run(core, ['paths'])).toContain('No lat.md directory found');
    expect(run(core, ['paths', '--config'])).toBe(
      `- **Config file:** \`${config}\` (not found)`,
    );
  }
  mkdirSync(resolve(config, '..'), { recursive: true });
  writeFileSync(config, JSON.stringify({ llm_key: 'sk-do-not-print-me' }));
  writeFileSync(join(scratch, 'key.txt'), 'sk-also-do-not-print-me');
  for (const core of [true, false]) {
    const filtered = run(core, [
      '--dir',
      join(scratch, 'missing'),
      'paths',
      '--config',
    ]);
    expect(filtered).toBe(`- **Config file:** \`${config}\``);
    expect(run(core, ['config'])).toBe(filtered);
    expect(run(core, ['paths'])).not.toContain('do-not-print-me');
  }
});
