import { projectWritePath, writeProjectFile } from './project-write.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Bump this number whenever `lat init` setup or defaults change in a way that
 * requires users to re-run it (e.g. new hooks, generated files, MCP config, or
 * a configuration migration).
 */
export const INIT_VERSION = 6;

/**
 * Where `lat init` arranged for `lat check` to be enforced: the Git pre-commit
 * hook, agent completion hooks (projects without Git), or nowhere.
 */
export type InitValidation = 'commit' | 'completion' | 'manual';

/** Commit checks need a Git worktree; a missing Git executable counts as none. */
export function isGitWorktree(directory: string): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: directory,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim() === 'true'
    );
  } catch {
    return false;
  }
}

type InitMeta = {
  init_version: number;
  /** Absent in metadata written before the workflow was recorded. */
  validation?: InitValidation;
  /** SHA-256 hashes of template-generated files, keyed by project-relative path. */
  file_hashes?: Record<string, string>;
};

function cachePath(latDir: string): string {
  return projectWritePath(
    dirname(latDir),
    join(latDir, '.cache', 'lat_init.json'),
  );
}

function readMeta(latDir: string): InitMeta | null {
  const p = cachePath(latDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function readInitVersion(latDir: string): number | null {
  const meta = readMeta(latDir);
  if (!meta) return null;
  return typeof meta.init_version === 'number' ? meta.init_version : null;
}

export function readInitValidation(latDir: string): InitValidation | null {
  const value = readMeta(latDir)?.validation;
  return value === 'commit' || value === 'completion' || value === 'manual'
    ? value
    : null;
}

export function readFileHash(latDir: string, relPath: string): string | null {
  const meta = readMeta(latDir);
  return meta?.file_hashes?.[relPath] ?? null;
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function writeInitMeta(
  latDir: string,
  fileHashes: Record<string, string>,
  validation?: InitValidation,
): void {
  const cacheDir = projectWritePath(dirname(latDir), join(latDir, '.cache'));
  mkdirSync(cacheDir, { recursive: true });
  // Merge with existing hashes so we don't lose entries from agents
  // that weren't selected this run
  const existing = readMeta(latDir);
  const mergedHashes = { ...existing?.file_hashes, ...fileHashes };
  const data: InitMeta = {
    init_version: INIT_VERSION,
    ...(validation ? { validation } : {}),
    file_hashes: mergedHashes,
  };
  writeProjectFile(
    dirname(latDir),
    cachePath(latDir),
    JSON.stringify(data, null, 2) + '\n',
  );
}
