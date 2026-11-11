import { determineAgent } from '@vercel/detect-agent';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  symlinkSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { isSourceFileExtension } from '@lat.md/core/source-formats';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { resolveLatInvocation } from './agent-invocation.js';
import { isExperimentEnabled } from './experiments.js';

/** Environment detection is a workflow guard, not an authorization boundary. */
export async function isAgentCommit(): Promise<boolean> {
  const result = await determineAgent();
  if (!result.isAgent) return process.env.CLAUDE_CODE_CHILD_SESSION === '1';
  if (result.agent.name === 'claude' || result.agent.name === 'cowork') {
    return (
      Boolean(process.env.AI_AGENT?.trim()) ||
      process.env.CLAUDE_CODE_CHILD_SESSION === '1'
    );
  }
  return true;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

type Entry = { mode: string; oid: string; path: string };

/** Avoid reminders for very small edits without imposing a documentation ratio. */
const REVIEW_CODE_LINES = 5;

/** Request review of staged code, allowing an explicit acknowledgment on retry. */
function requestDocumentationReview(
  root: string,
  projects: Set<string>,
  excluded: string[],
): boolean {
  if (process.env.LAT_BYPASS_COMMIT_HOOK === '1') return false;
  try {
    const records = git(root, [
      'diff',
      '--cached',
      '--numstat',
      '-z',
      '--no-renames',
      '--no-ext-diff',
    ]).split('\0');
    let codeLines = 0;
    for (const record of records) {
      // Keep tabs and newlines in filenames intact; binary diffs do not match.
      const match = /^(\d+)\t(\d+)\t([\s\S]+)$/.exec(record);
      if (!match) continue;
      const path = match[3];
      if (
        !isSourceFileExtension(extname(path)) ||
        path.split('/').includes('lat.md') ||
        excluded.some((prefix) => path.startsWith(prefix + '/')) ||
        ![...projects].some(
          (prefix) => !prefix || path.startsWith(prefix + '/'),
        )
      )
        continue;
      codeLines += Number(match[1]) + Number(match[2]);
      if (codeLines >= REVIEW_CODE_LINES) {
        console.error(
          'IMPORTANT: lat precommit hook suggests reviewing the staged code and lat.md changes to check that important behavior, architecture, and test changes are covered. This commit was stopped for review. If no Lat update is needed, or the changes are already covered, you may retry with LAT_BYPASS_COMMIT_HOOK=1 git commit ... (using your original commit arguments). If coverage is missing, update and stage the relevant Lat documentation, then retry with the same flag. The flag skips this review reminder only; validation and other Git hooks still run.\n\n',
        );
        return true;
      }
    }
  } catch {
    // An unavailable heuristic diff must not prevent an otherwise valid commit.
  }
  return false;
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function indexEntries(root: string): Entry[] {
  return git(root, ['ls-files', '--stage', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(record);
      if (!match || match[3] !== '0')
        throw new Error('Resolve unmerged index entries before committing.');
      const path = match[4];
      if (
        path
          .split('/')
          .some((part) => part === '..' || part.toLowerCase() === '.git') ||
        !inside(root, resolve(root, path))
      )
        throw new Error(`Unsafe staged path: ${path}`);
      return { mode: match[1], oid: match[2], path };
    });
}

type HookConfig = {
  validation: 'staged' | 'working-tree';
  'exclude-projects': string[];
};

/** Read repository-wide hook settings from the staged root document only. */
function readHookConfig(root: string, entries: Entry[]): HookConfig {
  const defaults: HookConfig = { validation: 'staged', 'exclude-projects': [] };
  const entry = entries.find((entry) => entry.path === 'lat.md/lat.md');
  if (!entry) return defaults;
  if (entry.mode !== '100644' && entry.mode !== '100755')
    throw new Error('Staged lat.md/lat.md must be a regular file.');
  const content = git(root, ['cat-file', 'blob', entry.oid]);
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!frontmatter) return defaults;
  const config = z
    .object({
      lat: z
        .object({
          'git-pre-commit': z
            .object({
              validation: z.enum(['staged', 'working-tree']).default('staged'),
              'exclude-projects': z
                .array(
                  z
                    .string()
                    .refine(
                      (path) =>
                        !/[\\:*?\[\]\x00]/.test(path) &&
                        path
                          .split('/')
                          .every(
                            (part) =>
                              part !== '' && part !== '.' && part !== '..',
                          ),
                      'Expected a repository-relative directory path without globs',
                    ),
                )
                .default([]),
            })
            .strict()
            .optional(),
        })
        .optional(),
    })
    .parse(parseYaml(frontmatter[1]) ?? {});
  return config.lat?.['git-pre-commit'] ?? defaults;
}

/** Export raw index blobs, without checkout filters or changing the real index. */
async function exportIndex(
  root: string,
  snapshot: string,
  entries: Entry[],
): Promise<void> {
  const blobs = entries.filter((entry) => entry.mode !== '160000');
  const child = spawn('git', ['cat-file', '--batch'], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const finished = once(child, 'close');
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  // Consume stdout while stdin drains; repositories can have more IDs than a pipe holds.
  child.stdin.on('error', () => {});
  child.stdin.end(blobs.map((entry) => entry.oid).join('\n') + '\n');
  let buffer = Buffer.alloc(0);
  let size: number | undefined;
  let index = 0;
  const symlinks: { path: string; target: string }[] = [];
  try {
    for await (const chunk of child.stdout) {
      buffer = Buffer.concat([buffer, chunk]);
      while (index < blobs.length) {
        if (size === undefined) {
          const newline = buffer.indexOf(10);
          if (newline < 0) break;
          const header = buffer.subarray(0, newline).toString('utf8');
          const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
          if (!match || match[1] !== blobs[index].oid)
            throw new Error(`Cannot read staged blob: ${header}`);
          size = Number(match[2]);
          buffer = buffer.subarray(newline + 1);
        }
        if (buffer.length < size + 1) break;
        const entry = blobs[index++];
        const path = join(snapshot, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        const content = buffer.subarray(0, size);
        if (entry.mode === '120000') {
          const target = content.toString('utf8');
          if (
            isAbsolute(target) ||
            !inside(snapshot, resolve(dirname(path), target))
          ) {
            throw new Error(
              `Staged symlink escapes the commit snapshot: ${entry.path}`,
            );
          }
          symlinks.push({ path, target });
        } else {
          writeFileSync(path, content, {
            mode: entry.mode === '100755' ? 0o755 : 0o644,
          });
        }
        buffer = buffer.subarray(size + 1);
        size = undefined;
      }
    }
    const [code] = await finished;
    if (code !== 0 || index !== blobs.length)
      throw new Error(stderr || 'Incomplete staged snapshot.');
    // Gitlinks represent directories, not files from the submodule working tree.
    for (const entry of entries.filter((entry) => entry.mode === '160000'))
      mkdirSync(join(snapshot, entry.path), { recursive: true });
    for (const link of symlinks) symlinkSync(link.target, link.path);
    const canonicalSnapshot = realpathSync(snapshot);
    for (const link of symlinks) {
      if (!inside(canonicalSnapshot, realpathSync(link.path)))
        throw new Error(`Unsafe staged symlink: ${link.path}`);
    }
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

/** Check every staged Lat project affected by this commit, including nested ones. */
export async function gitPreCommit(cwd = process.cwd()): Promise<number> {
  if (!(await isAgentCommit())) return 0;
  let temporary: string | undefined;
  try {
    // Preserve Git's environment here, especially GIT_INDEX_FILE for partial commits.
    const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
    const changed = git(root, [
      'diff',
      '--cached',
      '--name-only',
      '-z',
      '--no-renames',
    ])
      .split('\0')
      .filter(Boolean);
    if (!changed.length) return 0;
    const entries = indexEntries(root);
    const projects = new Set<string>();
    for (const entry of entries) {
      const parts = entry.path.split('/');
      const index = parts.indexOf('lat.md');
      if (index < 0 || index === parts.length - 1) continue;
      const prefix = parts.slice(0, index).join('/');
      if (changed.some((path) => !prefix || path.startsWith(prefix + '/')))
        projects.add(prefix);
    }
    for (const project of projects) {
      if (!isExperimentEnabled('commit-hooks', join(root, project)))
        projects.delete(project);
    }
    if (!projects.size) return 0;
    const config = readHookConfig(root, entries);
    const excluded = config['exclude-projects'];
    for (const project of projects) {
      if (
        excluded.some(
          (path) => project === path || project.startsWith(path + '/'),
        )
      )
        projects.delete(project);
    }
    if (!projects.size) return 0;
    // Run check like a normal invocation, without commit-specific Git overrides.
    const localGitVariables = new Set(
      git(root, ['rev-parse', '--local-env-vars']).trim().split('\n'),
    );
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !localGitVariables.has(key),
      ),
    );
    env.NO_COLOR = '1';
    let checkRoot = root;
    if (config.validation === 'staged') {
      temporary = mkdtempSync(join(tmpdir(), 'lat-staged-'));
      checkRoot = join(temporary, 'tree');
      mkdirSync(checkRoot);
      await exportIndex(root, checkRoot, entries);
      // External checkout caches are disposable too, outside the staged project.
      env.XDG_CACHE_HOME = join(temporary, 'cache');
      // Supply the staged inventory to source scanners, including tracked ignored files.
      execFileSync(
        'git',
        [
          '-c',
          'init.templateDir=',
          'init',
          '--quiet',
          `--object-format=${git(root, ['rev-parse', '--show-object-format']).trim()}`,
          checkRoot,
        ],
        { env, stdio: 'pipe' },
      );
      execFileSync('git', ['update-index', '-z', '--index-info'], {
        cwd: checkRoot,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        input: entries
          .map((entry) => `${entry.mode} ${entry.oid}\t${entry.path}\0`)
          .join(''),
      });
    }
    const invocation = resolveLatInvocation();
    let failed = false;
    for (const project of projects) {
      const result = spawnSync(
        invocation.command,
        [...invocation.args, 'check', '--', 'lat.md'],
        {
          cwd: join(checkRoot, project),
          env,
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      if (result.status === 0) continue;
      failed = true;
      const output = [result.stdout, result.stderr, result.error?.message]
        .filter(Boolean)
        .join('\n');
      console.error(
        `Lat ${config.validation} validation failed (${project || '.'}):\n${output.split(checkRoot).join(root)}`,
      );
    }
    if (failed) {
      console.error(
        config.validation === 'staged'
          ? 'Fix the errors and stage the fixes before committing again. Run `lat check` while editing.'
          : 'Fix the working-tree errors before committing again. Run `lat check` in the project directory.',
      );
      return 1;
    }
    return requestDocumentationReview(root, projects, excluded) ? 1 : 0;
  } catch (error) {
    console.error(
      `Lat could not validate the commit: ${(error as Error).message}`,
    );
    return 1;
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
