import {
  lstatSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function canonicalRoot(path: string): string {
  try {
    return realpathSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(canonicalRoot(parent), relative(parent, path));
  }
}

/** Validate every existing component before reading or changing project setup. */
export function projectWritePath(projectRoot: string, path: string): string {
  const root = resolve(projectRoot);
  const target = resolve(path);
  const fail = () =>
    new Error(
      `Unsafe initialization path outside the project or through a dangling symlink: ${path}`,
    );
  const realRoot = canonicalRoot(root);
  const base = inside(root, target) ? root : realRoot;
  if (!inside(base, target)) throw fail();
  let cursor = realRoot;
  const parts = relative(base, target).split(sep).filter(Boolean);
  for (let index = 0; index < parts.length; index++) {
    cursor = join(cursor, parts[index]);
    let info;
    try {
      info = lstatSync(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return join(cursor, ...parts.slice(index + 1));
    }
    if (info.isSymbolicLink()) {
      try {
        cursor = realpathSync(cursor);
      } catch {
        throw fail();
      }
      if (!inside(realRoot, cursor)) throw fail();
    }
  }
  return cursor;
}

/** Replace the validated target atomically, preserving in-project symlinks. */
export function writeProjectFile(
  projectRoot: string,
  path: string,
  content: string,
): void {
  const target = projectWritePath(projectRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.lat-init-${randomUUID()}`);
  let mode: number | undefined;
  try {
    mode = lstatSync(target).mode;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    writeFileSync(temporary, content, { flag: 'wx', mode: mode ?? 0o600 });
    projectWritePath(projectRoot, path);
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}
