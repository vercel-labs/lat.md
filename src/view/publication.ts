import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, relative, sep } from 'node:path';
import {
  normalizeRepositoryPath,
  inspectRepositoryPath,
} from '@lat.md/core/repository-path';
import { walkEntries } from '@lat.md/core/walk';

const exec = promisify(execFile);
const portable = (path: string) => path.split(sep).join('/');

function publicPath(path: string): boolean {
  return path
    .split('/')
    .every(
      (part) =>
        part.toLowerCase() !== 'config.local.yaml' &&
        part.toLowerCase() !== 'node_modules' &&
        !part.startsWith('.'),
    );
}

/** Publication scope is deliberately narrower than interactive source browsing. */
export async function createPublicationPolicy(
  projectRoot: string,
): Promise<(path: string) => Promise<boolean>> {
  let files: string[];
  const git = (args: string[]) =>
    exec('git', ['-c', 'core.fsmonitor=false', ...args], {
      cwd: projectRoot,
      maxBuffer: 50 * 1024 * 1024,
    });
  let tracked: string;
  try {
    tracked = (await git(['ls-files', '--stage', '-z', '--', '.'])).stdout;
  } catch (error) {
    // A directory without Git still has a useful publication policy: honor
    // .gitignore and the ordinary walker exclusions rather than publish all files.
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
      !String((error as { stderr?: string }).stderr).includes(
        'not a git repository',
      )
    )
      throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      for (let directory = projectRoot; ; directory = dirname(directory)) {
        if (existsSync(join(directory, '.git')))
          throw new Error(
            'Git is required to determine publication scope for this checkout',
          );
        if (dirname(directory) === directory) break;
      }
    }
    files = await walkEntries(projectRoot);
    return policy(new Set(files.filter(publicPath)), projectRoot);
  }
  const ignored = new Set(
    (
      await git([
        'ls-files',
        '--cached',
        '--ignored',
        '--exclude-standard',
        '-z',
        '--',
        '.',
      ])
    ).stdout.split('\0'),
  );
  files = tracked.split('\0').flatMap((entry) => {
    const tab = entry.indexOf('\t');
    const mode = entry.slice(0, entry.indexOf(' '));
    if (tab < 0 || !['100644', '100755'].includes(mode)) return [];
    const path = entry.slice(tab + 1);
    return publicPath(path) && !ignored.has(path) ? [path] : [];
  });
  return policy(new Set(files), projectRoot);
}

function policy(files: ReadonlySet<string>, root: string) {
  const realRoot = realpath(root);
  return async (authoredPath: string): Promise<boolean> => {
    const path = normalizeRepositoryPath(authoredPath);
    if (!path || path !== authoredPath || !publicPath(path) || !files.has(path))
      return false;
    const inspected = await inspectRepositoryPath(root, path);
    if (inspected.kind !== 'file') return false;
    const real = inspected.realPath;
    // Resolving the root through a platform alias must not change membership.
    const realRelative = portable(relative(await realRoot, real));
    return publicPath(realRelative) && files.has(realRelative);
  };
}
