import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTemplatesDir } from './templates.js';
import { recordedValidation } from './validation.js';
import { findProjectRoot } from '@lat.md/core/project-discovery';

function readTemplate(name: string): string {
  return readFileSync(join(findTemplatesDir(), name), 'utf-8');
}

/**
 * Instructions describe commit-time validation by default. Setups without
 * the Git hook get the `no-git-hook` variants, which ask for `lat check`
 * after every task.
 */
export function readAgentsTemplate(gitHook = true): string {
  return readTemplate(gitHook ? 'AGENTS.md' : 'no-git-hook/AGENTS.md');
}

export function readCursorRulesTemplate(gitHook = true): string {
  return readTemplate(
    gitHook ? 'cursor-rules.md' : 'no-git-hook/cursor-rules.md',
  );
}

/** `lat init` injects the lat command and validation workflow into these. */
export function readPiExtensionTemplate(): string {
  return readTemplate('pi-extension.ts');
}

export function readOpenCodePluginTemplate(): string {
  return readTemplate('opencode-plugin.ts');
}

export function readSkillTemplate(): string {
  return readFileSync(join(findTemplatesDir(), 'skill', 'SKILL.md'), 'utf-8');
}

export async function genCmd(target: string, from?: string): Promise<void> {
  // Projects that declined the Git hook keep end-of-task instructions.
  const recorded = recordedValidation(findProjectRoot(from));
  const gitHook = recorded === null || recorded === 'commit';
  const normalized = target.toLowerCase();
  switch (normalized) {
    case 'agents.md':
    case 'claude.md':
      process.stdout.write(readAgentsTemplate(gitHook));
      break;
    case 'cursor-rules.md':
      process.stdout.write(readCursorRulesTemplate(gitHook));
      break;
    case 'pi-extension.ts':
      process.stdout.write(readPiExtensionTemplate());
      break;
    case 'opencode-plugin.ts':
      process.stdout.write(readOpenCodePluginTemplate());
      break;
    case 'skill.md':
      process.stdout.write(readSkillTemplate());
      break;
    default:
      console.error(
        `Unknown target: ${target}. Supported: agents.md, claude.md, cursor-rules.md, pi-extension.ts, opencode-plugin.ts, skill.md`,
      );
      process.exit(1);
  }
}
