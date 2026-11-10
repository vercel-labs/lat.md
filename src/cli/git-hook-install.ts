import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectWritePath, writeProjectFile } from '@lat.md/core/project-write';
import type { AgentInvocation } from './agent-invocation.js';

const MARKER = '# lat git-pre-commit v1 sha256=';
const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const quote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";

export type GitHookInstallation = {
  status:
    | 'installed'
    | 'already configured'
    | 'integration required'
    | 'skipped';
  detail: string;
};

function hookScript(invocation: AgentInvocation): string {
  const { command, args } = invocation;
  const words = [command, ...args].map((arg) =>
    quote(process.platform === 'win32' ? arg.replace(/\\/g, '/') : arg),
  );
  // A removed Node/Lat installation must never strand a manual commit.
  const entry = args.at(-1);
  const body =
    `# Installed by lat init. Re-run lat init to update.\n` +
    `if ! command -v ${words[0]} >/dev/null 2>&1; then\n  echo 'Lat hook unavailable; run lat init to repair it.' >&2\n  exit 0\nfi\n` +
    (entry
      ? `if [ ! -f ${words.at(-1)} ]; then\n  echo 'Lat hook unavailable; run lat init to repair it.' >&2\n  exit 0\nfi\n`
      : '') +
    `exec ${words.join(' ')} hook git-pre-commit\n`;
  return `#!/bin/sh\n${MARKER}${digest(body)}\n${body}`;
}

function isUnmodifiedLatHook(content: string): boolean {
  const lines = content.split('\n');
  return (
    lines[0] === '#!/bin/sh' &&
    lines[1] === MARKER + digest(lines.slice(2).join('\n'))
  );
}

/** Never replace a hook manager, custom hook, or custom hooksPath. */
export function installGitHook(
  root: string,
  invocation: AgentInvocation,
): GitHookInstallation {
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  let top: string;
  try {
    top = git(['rev-parse', '--show-toplevel']);
  } catch {
    return {
      status: 'skipped',
      detail: 'No Git worktree. Use lat check manually.',
    };
  }
  const command = 'lat hook git-pre-commit';
  let hooksPath = '';
  try {
    hooksPath = git(['config', '--get', 'core.hooksPath']);
  } catch {}
  const manager = existsSync(join(top, '.pre-commit-config.yaml'))
    ? 'pre-commit'
    : existsSync(join(top, '.husky'))
      ? 'Husky'
      : [
            'lefthook.yml',
            'lefthook.yaml',
            '.lefthook.yml',
            '.lefthook.yaml',
          ].some((path) => existsSync(join(top, path)))
        ? 'Lefthook'
        : undefined;
  if (hooksPath || manager) {
    const instruction =
      manager === 'Husky'
        ? `Add \`${command}\` after existing commands in .husky/pre-commit (preserving their failure status).`
        : manager === 'pre-commit'
          ? `Add a repo: local hook to .pre-commit-config.yaml with entry: ${command}, language: system, pass_filenames: false, always_run: true, stages: [pre-commit].`
          : manager === 'Lefthook'
            ? `Add a pre-commit command with run: ${command} to your Lefthook configuration, after any staging commands.`
            : `Add \`${command}\` to the existing pre-commit workflow.`;
    return {
      status: 'integration required',
      detail: `${manager ?? `core.hooksPath=${hooksPath}`} preserved. ${instruction} Lat has not installed a Git hook.`,
    };
  }
  // Linked worktrees share hooks in their common Git directory. Do not bake in top/root.
  const common = resolve(root, git(['rev-parse', '--git-common-dir']));
  const path = join(common, 'hooks', 'pre-commit');
  const content = hookScript(invocation);
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      !isUnmodifiedLatHook(readFileSync(projectWritePath(common, path), 'utf8'))
    ) {
      return {
        status: 'integration required',
        detail: `Existing ${path} preserved. Add \`${command}\` to its workflow; preserve existing exit codes. Lat has not installed a Git hook.`,
      };
    }
    // Windows does not expose Unix executable bits; Git runs the shell hook there.
    const executable =
      process.platform === 'win32' || (info.mode & 0o111) !== 0;
    if (readFileSync(path, 'utf8') === content && executable) {
      return { status: 'already configured', detail: path };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  writeProjectFile(common, path, content);
  chmodSync(projectWritePath(common, path), 0o755);
  return { status: 'installed', detail: path };
}
