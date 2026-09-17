import { lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import xdg from '@folder/xdg';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Reject repository-controlled symlinks before accessing a disposable cache. */
export function assertCachePath(latDir: string, path: string): string {
  const root = resolve(latDir);
  const target = resolve(path);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(
      `cache path is outside the documentation directory: "${path}"`,
    );
  }
  let cursor = root;
  const parts = rel ? rel.split(sep) : [];
  for (let index = 0; index <= parts.length; index++) {
    if (index > 0) cursor = join(cursor, parts[index - 1]);
    let stat;
    try {
      stat = lstatSync(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`unsafe cache path: symbolic link "${cursor}"`);
    }
    if (index < parts.length && !stat.isDirectory()) {
      throw new Error(`unsafe cache path: not a directory "${cursor}"`);
    }
  }
  return path;
}

// Resolve existing ancestors too, so a user-cache alias into the project fails closed.
function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(canonicalPath(parent), relative(parent, path));
  }
}

export function managedCacheRoot(latDir: string, projectRoot: string): string {
  const cacheHome = canonicalPath(resolve(xdg().cache));
  const identity = createHash('sha256')
    .update(realpathSync(latDir))
    .digest('hex');
  const root = join(managedCacheBase(), identity);
  const rel = relative(realpathSync(projectRoot), root);
  if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)) {
    throw new Error('managed Git cache must be outside the project');
  }
  return assertCachePath(cacheHome, root);
}

/** Platform user cache location; querying it does not create directories. */
export function managedCacheBase(): string {
  return join(
    canonicalPath(resolve(xdg().cache)),
    'lat',
    'external-checkouts-v1',
  );
}
