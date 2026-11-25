import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { projectWritePath, writeProjectFile } from '@lat.md/core/project-write';
import { acquireFileLock } from '../file-lock.js';

const BEGIN = '%% lat:members:begin %%';
const END = '%% lat:members:end %%';

const WORKSPACE_INSTRUCTIONS = `${BEGIN}
# Lat workspace members

For each part of a task, find the nearest directory enclosing the affected files that contains \`lat.md/\`. Read that project's \`AGENTS.md\` if present and follow its Lat workflow for that part of the task.

From the Git root, select the owning member before searching or validating. For example, run \`lat --dir packages/api search "describe the task"\` and \`lat --dir packages/api check\` for work in \`packages/api/\`. For work spanning members, run the commands separately for each affected member. Follow the root vault's instructions for work it owns.
${END}
`;

function gitPath(cwd: string, option: string): string {
  const path = execFileSync('git', ['rev-parse', option], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  }).replace(/\r?\n$/, '');
  return realpathSync.native(path);
}

export function findInitWorktree(
  projectRoot: string,
): { root: string; isMember: boolean } | null {
  try {
    const root = gitPath(projectRoot, '--show-toplevel');
    const path = relative(root, realpathSync.native(projectRoot));
    if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`))
      return null;
    return { root, isMember: path !== '' };
  } catch {
    return null;
  }
}

export async function withWorktreeAgentsLock<T>(
  root: string,
  edit: () => T | Promise<T>,
  { allowReadOnlyGitDir = false } = {},
): Promise<T> {
  // A linked worktree has its own AGENTS.md and its own Git directory.
  const gitDir = gitPath(root, '--absolute-git-dir');
  const release = await acquireFileLock(
    projectWritePath(gitDir, join(gitDir, 'lat-agents.lock')),
    'exclusive',
    performance.now() + 120_000,
    'Another lat init is updating the Git-root AGENTS.md. Retry shortly.',
  ).catch((error: NodeJS.ErrnoException) => {
    // Member init needs the lock to edit the shared file. Ordinary root setup
    // can still write its own instructions when Git metadata is read-only.
    if (
      allowReadOnlyGitDir &&
      ['EACCES', 'EPERM', 'EROFS'].includes(error.code ?? '')
    )
      return undefined;
    throw error;
  });
  try {
    return await edit();
  } finally {
    await release?.();
  }
}

/** Install shared member guidance while preserving existing instructions. */
export function writeWorkspaceInstructions(root: string): Promise<boolean> {
  return withWorktreeAgentsLock(root, () => {
    const path = join(root, 'AGENTS.md');
    const target = projectWritePath(root, path);
    let content = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (content.includes(BEGIN) || content.includes(END)) return false;
    if (content && !content.endsWith('\n')) content += '\n';
    if (content && !content.endsWith('\n\n')) content += '\n';
    writeProjectFile(root, path, content + WORKSPACE_INSTRUCTIONS);
    return true;
  });
}
