import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '@lat.md/core/project-discovery';
import { projectWritePath, writeProjectFile } from '@lat.md/core/project-write';
import { isGitWorktree } from '@lat.md/core/init-version';

/** Available experiments are opt-in and independently selectable. */
export const EXPERIMENTS = [
  {
    id: 'commit-hooks',
    label: 'Replace end-of-turn checks with Git commit checks',
    description:
      'Validate documentation when an agent commits (staged by default, optionally the working tree), remove Lat Stop hooks, and refresh Pi/OpenCode completion integrations. Prompt context stays enabled; manual commits skip validation. Custom Git hooks require manual integration. Projects without Git are warned and may keep end-of-turn checks.',
  },
] as const;

export type ExperimentId = (typeof EXPERIMENTS)[number]['id'];
export type ExperimentChoices = Record<string, boolean>;

function experimentsPath(root: string): string {
  return projectWritePath(
    root,
    join(root, 'lat.md', '.cache', 'experiments.json'),
  );
}

/** Read on each call so project switches and changed choices take effect immediately. */
export function readExperiments(root: string): ExperimentChoices {
  const path = experimentsPath(root);
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (
      data?.version !== 1 ||
      !data.experiments ||
      typeof data.experiments !== 'object' ||
      Array.isArray(data.experiments) ||
      Object.values(data.experiments).some(
        (value) => typeof value !== 'boolean',
      )
    )
      throw new Error(
        'Expected version 1 and an experiments object containing boolean choices',
      );
    return data.experiments;
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${(error as Error).message}`);
  }
}

/** Persist confirmed choices atomically, including disabled and unknown experiment IDs. */
export function writeExperiments(
  root: string,
  experiments: ExperimentChoices,
): void {
  writeProjectFile(
    root,
    experimentsPath(root),
    JSON.stringify({ version: 1, experiments }, null, 2) + '\n',
  );
}

export function isExperimentEnabled(
  id: ExperimentId,
  root: string | null = findProjectRoot(),
): boolean {
  return root !== null && readExperiments(root)[id] === true;
}

/**
 * Commit checks replace end-of-turn validation only where a commit exists to
 * hook into: the experiment must be enabled and the project inside a Git
 * worktree. Opted-in projects without Git keep end-of-turn validation.
 */
export function usesCommitChecks(
  root: string | null = findProjectRoot(),
): boolean {
  return (
    root !== null &&
    isExperimentEnabled('commit-hooks', root) &&
    isGitWorktree(root)
  );
}
