import { extname } from 'node:path';
import { normalizeRepositoryPath } from '@lat.md/core/repository-path';
import { isSourceFileExtension } from '@lat.md/core/source-formats';
import {
  documentUrl,
  documentResourceUrl,
  rewriteDocumentLink,
} from './document-route.js';

/** Resolve ordinary code links relative to their Markdown file, not the vault root. */
export function rewriteLocalFileLink(
  value: string,
  sourcePath: string,
): string {
  if (value && !/^(?:[#/]|[a-z][a-z\d+.-]*:)/i.test(value)) {
    try {
      // Keep a project prefix so URL normalization cannot silently clamp an
      // escaping relative path back into the project.
      const preview = sourcePath.startsWith('@/');
      const authoredPath = preview
        ? sourcePath.slice(2)
        : 'lat.md/' + sourcePath;
      const base = authoredPath.split('/').map(encodeURIComponent).join('/');
      const url = new URL(value, `http://lat.local/project/${base}`);
      if (
        url.origin === 'http://lat.local' &&
        url.pathname.startsWith('/project/')
      ) {
        const path = decodeURIComponent(url.pathname.slice('/project/'.length));
        if (path.includes('@')) return '#';
        const suffix = url.search + url.hash;
        if (
          normalizeRepositoryPath(path) &&
          extname(path).toLowerCase() === '.md'
        ) {
          return (
            documentUrl(
              path.startsWith('lat.md/') ? path.slice(7) : '@/' + path,
            ) + suffix
          );
        }
        if (
          preview &&
          normalizeRepositoryPath(path) &&
          !isSourceFileExtension(extname(path))
        ) {
          return (
            documentResourceUrl(
              path.startsWith('lat.md/') ? path.slice(7) : '@/' + path,
            ) + suffix
          );
        }
        if (
          normalizeRepositoryPath(path) &&
          (!path.startsWith('lat.md/') || isSourceFileExtension(extname(path)))
        ) {
          return `/code/${path.split('/').map(encodeURIComponent).join('/')}${url.search}${url.hash}`;
        }
      }
    } catch {
      // Malformed URLs retain the ordinary document/resource fallback.
    }
  }
  if (
    sourcePath.startsWith('@/') &&
    value &&
    !/^(?:[#/]|[a-z][a-z\d+.-]*:)/i.test(value)
  )
    return '#';
  return rewriteDocumentLink(value, sourcePath);
}

export type ViewSourceTarget = {
  path: string;
  symbol: string;
  key: string;
  fileKey: string;
};

/** Normalize a supported source wiki-link target for view indexes and routes. */
export function viewSourceTarget(target: string): ViewSourceTarget | null {
  const hash = target.indexOf('#');
  const authoredPath = hash === -1 ? target : target.slice(0, hash);
  const path = normalizeRepositoryPath(authoredPath);
  if (!path || !isSourceFileExtension(extname(path))) return null;

  const symbol = hash === -1 ? '' : target.slice(hash + 1);
  const fileKey = path.toLowerCase();
  return {
    path,
    symbol,
    key: `${fileKey}${symbol ? `#${symbol.toLowerCase()}` : ''}`,
    fileKey,
  };
}
