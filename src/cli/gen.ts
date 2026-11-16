import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTemplatesDir } from './templates.js';
import { isExperimentEnabled, usesCommitChecks } from './experiments.js';
import { findProjectRoot } from '@lat.md/core/project-discovery';

function readTemplate(name: string, experimental: boolean): string {
  return readFileSync(
    join(findTemplatesDir(), experimental ? 'experimental' : '.', name),
    'utf-8',
  );
}

/**
 * Instructions describe commit-time validation only where commit checks are
 * active; opted-in projects without Git keep the end-of-task checklist.
 */
export function readAgentsTemplate(root?: string | null): string {
  return readTemplate('AGENTS.md', usesCommitChecks(root));
}

export function readCursorRulesTemplate(root?: string | null): string {
  return readTemplate('cursor-rules.md', usesCommitChecks(root));
}

/**
 * Opted-in projects share one plugin template per agent; `lat init` injects
 * the validation workflow into it.
 */
export function readPiExtensionTemplate(root?: string | null): string {
  return readTemplate(
    'pi-extension.ts',
    isExperimentEnabled('commit-hooks', root),
  );
}

export function readOpenCodePluginTemplate(root?: string | null): string {
  return readTemplate(
    'opencode-plugin.ts',
    isExperimentEnabled('commit-hooks', root),
  );
}

export function readSkillTemplate(): string {
  return readFileSync(join(findTemplatesDir(), 'skill', 'SKILL.md'), 'utf-8');
}

export async function genCmd(target: string, from?: string): Promise<void> {
  const root = findProjectRoot(from);
  const normalized = target.toLowerCase();
  switch (normalized) {
    case 'agents.md':
    case 'claude.md':
      process.stdout.write(readAgentsTemplate(root));
      break;
    case 'cursor-rules.md':
      process.stdout.write(readCursorRulesTemplate(root));
      break;
    case 'pi-extension.ts':
      process.stdout.write(readPiExtensionTemplate(root));
      break;
    case 'opencode-plugin.ts':
      process.stdout.write(readOpenCodePluginTemplate(root));
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
