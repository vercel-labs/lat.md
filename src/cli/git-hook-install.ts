import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { projectWritePath, writeProjectFile } from '@lat.md/core/project-write';
import type { AgentInvocation } from './agent-invocation.js';

const MARKER = '# lat git-pre-commit v1 sha256=';
const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const quote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";
const shellPath = (path: string) =>
  process.platform === 'win32' ? path.replace(/\\/g, '/') : path;

export function supportsConfiguredHooks(version: string): boolean {
  const match = /^git version (\d+)\.(\d+)(?:\.|\s|$)/.exec(version);
  return !!match && (+match[1] > 2 || (+match[1] === 2 && +match[2] >= 54));
}

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

/** Preserve custom hooks and configuration on both installation paths. */
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
  // Linked worktrees share hooks/config; the launcher resolves the active tree.
  // Native resolution also canonicalizes casing and Windows short-name aliases.
  // The JS implementation preserves those spellings, breaking command equality.
  const common = realpathSync.native(
    resolve(root, git(['rev-parse', '--git-common-dir'])),
  );
  let configuredHooks = false;
  try {
    configuredHooks = supportsConfiguredHooks(git(['--version']));
  } catch {}
  if (configuredHooks) return installConfiguredHook(common, invocation, git);
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
  const path = join(common, 'hooks', 'pre-commit');
  return installLauncher(common, path, hookScript(invocation));
}

function installConfiguredHook(
  common: string,
  invocation: AgentInvocation,
  git: (args: string[]) => string,
): GitHookInstallation {
  const path = join(common, 'hooks', 'lat-pre-commit');
  const command = `sh ${quote(shellPath(path))}`;
  let config = '';
  try {
    config = git([
      'config',
      '--null',
      '--show-scope',
      '--get-regexp',
      '^hook\\.lat-md\\.',
    ]);
  } catch (error) {
    // Exit 1 means no matching keys. Other errors must not be mistaken for absence.
    if ((error as { status?: number }).status !== 1) throw error;
  }
  const entries = config ? config.split('\0').slice(0, -1) : [];
  const expected = new Set([
    `hook.lat-md.command\n${command}`,
    'hook.lat-md.event\npre-commit',
  ]);
  for (let i = 0; i < entries.length; i += 2) {
    if (entries[i] !== 'local' || !expected.delete(entries[i + 1])) {
      return {
        status: 'integration required',
        detail:
          'Existing hook.lat-md configuration preserved (including overrides or disabled hooks). Integrate `lat hook git-pre-commit` into your existing workflow.',
      };
    }
  }
  // Do not claim somebody else's partial configuration with just an event.
  if (entries.length && expected.has(`hook.lat-md.command\n${command}`)) {
    return {
      status: 'integration required',
      detail:
        'Existing hook.lat-md configuration preserved. Add `lat hook git-pre-commit` to its workflow.',
    };
  }
  const legacy = join(common, 'hooks', 'pre-commit');
  let migrate = false;
  try {
    const info = lstatSync(legacy);
    if (info.isFile() && !info.isSymbolicLink()) {
      const content = readFileSync(projectWritePath(common, legacy), 'utf8');
      migrate = isUnmodifiedLatHook(content);
      if (!migrate && content.includes(MARKER)) {
        return {
          status: 'integration required',
          detail: `Edited Lat hook ${legacy} preserved. Integrate \`lat hook git-pre-commit\` manually to avoid running it twice.`,
        };
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const launcher = installLauncher(common, path, hookScript(invocation));
  if (launcher.status === 'integration required') return launcher;
  const configured = entries.length === 4;
  if (!configured) {
    git(['config', '--local', '--replace-all', 'hook.lat-md.command', command]);
    git([
      'config',
      '--local',
      '--replace-all',
      'hook.lat-md.event',
      'pre-commit',
    ]);
  }
  // Only remove the old owned launcher once the replacement is configured.
  if (migrate) unlinkSync(projectWritePath(common, legacy));
  return {
    status: configured && !migrate ? launcher.status : 'installed',
    detail:
      'Repository config hook.lat-md (pre-commit). Runs before traditional hook scripts; workflows that stage files must run Lat again after staging.',
  };
}

function installLauncher(
  common: string,
  path: string,
  content: string,
): GitHookInstallation {
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      !isUnmodifiedLatHook(readFileSync(projectWritePath(common, path), 'utf8'))
    ) {
      return {
        status: 'integration required',
        detail: `Existing ${path} preserved. Add \`lat hook git-pre-commit\` to its workflow; preserve existing exit codes. Lat has not installed a Git hook.`,
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
