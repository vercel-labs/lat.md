import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { rmDirBestEffort } from './util.js';
import { syncLatHooks } from '../src/cli/init.js';

const clean = join(import.meta.dirname, 'cases', 'hook-clean');
const cliPath = join(import.meta.dirname, '..', 'src', 'cli', 'index.ts');
function runHook(
  agent: string,
  event: string,
  cwd: string,
  input: Record<string, unknown> = {},
) {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(
        join(import.meta.dirname, '../node_modules/tsx/dist/loader.mjs'),
      ).href,
      cliPath,
      'hook',
      agent,
      event,
    ],
    {
      cwd,
      encoding: 'utf8',
      input: JSON.stringify(input),
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return result;
}

// @lat: [[tests/hook#Legacy stop hooks are silent]]
it.each([
  ['claude', 'Stop'],
  ['codex', 'Stop'],
  ['cursor', 'stop'],
])('retires %s %s', (agent, event) => {
  const result = runHook(
    agent,
    event,
    join(import.meta.dirname, 'cases', 'error-broken-links'),
  );
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

describe('Codex hook integration', () => {
  // @lat: [[tests/hook#Prompt hooks do not expand references]]
  it.each(['claude', 'codex'])(
    '%s prompt hooks retain search guidance without expanding references',
    (agent) => {
      const dir = mkdtempSync(join(tmpdir(), 'lat-codex-prompt-'));
      const projectDir = join(dir, 'project');
      cpSync(clean, projectDir, { recursive: true });
      try {
        const { stdout } = runHook(agent, 'UserPromptSubmit', projectDir, {
          [agent === 'codex' ? 'prompt' : 'user_prompt']:
            'Update [[feature]] and [[missing]]',
        });
        const parsed = JSON.parse(stdout);
        const context = parsed.hookSpecificOutput.additionalContext;
        expect(context).toContain('lat search');
        expect(context).not.toContain('Expanded user prompt');
        expect(context).not.toContain('<lat-context>');
        expect(context).not.toContain('lat expand');
        expect(context).not.toContain('Ask the user to correct');
      } finally {
        rmDirBestEffort(dir);
      }
    },
  );

  // @lat: [[tests/hook#Codex hook setup preserves non-lat hooks]]
  it('syncs Codex hooks while preserving non-lat hooks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lat-codex-hooks-'));
    const hooksPath = join(dir, 'hooks.json');
    writeFileSync(
      hooksPath,
      JSON.stringify({
        description: 'Workspace hooks',
        hooks: {
          UserPromptSubmit: [
            {
              hooks: [{ type: 'command', command: 'custom prompt hook' }],
            },
            {
              hooks: [
                {
                  type: 'command',
                  command: 'lat hook claude UserPromptSubmit',
                },
              ],
            },
          ],
          Stop: [
            {
              hooks: [{ type: 'command', command: 'lat hook codex Stop' }],
            },
          ],
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'custom tool hook' }],
            },
          ],
        },
      }),
    );

    try {
      syncLatHooks(hooksPath, 'global', 'codex');
      const config = JSON.parse(readFileSync(hooksPath, 'utf-8'));
      expect(config.description).toBe('Workspace hooks');
      expect(config.hooks.PreToolUse).toHaveLength(1);
      expect(config.hooks.UserPromptSubmit).toHaveLength(2);
      expect(config.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
        'custom prompt hook',
      );
      expect(config.hooks.UserPromptSubmit[1].hooks[0].command).toBe(
        'lat hook codex UserPromptSubmit',
      );
      expect(config.hooks.Stop).toBeUndefined();
    } finally {
      rmDirBestEffort(dir);
    }
  });

  // @lat: [[tests/hook#Local JavaScript hook commands retain Node]]
  it('runs a local JavaScript CLI through Node', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lat-codex-local-hooks-'));
    const hooksPath = join(dir, 'hooks.json');
    const cliPath = join(dir, 'index.js');
    const originalScript = process.argv[1];

    try {
      writeFileSync(
        cliPath,
        'process.stdout.write(process.argv.slice(2).join(" "));\n',
      );
      process.argv[1] = cliPath;
      syncLatHooks(hooksPath, 'local', 'codex');

      const config = JSON.parse(readFileSync(hooksPath, 'utf-8'));
      const quote = (arg: string) => (arg.includes(' ') ? `"${arg}"` : arg);
      const command = config.hooks.UserPromptSubmit[0].hooks[0].command;
      expect(command).toBe(
        `${quote(process.execPath)} ${quote(cliPath)} hook codex UserPromptSubmit`,
      );

      const result = spawnSync(command, { shell: true, encoding: 'utf-8' });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('hook codex UserPromptSubmit');
    } finally {
      process.argv[1] = originalScript;
      rmDirBestEffort(dir);
    }
  });
});
