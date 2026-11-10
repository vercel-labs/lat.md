import { realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { relative, resolve } from 'node:path';
import { toPosix } from '@lat.md/core/path';
import { normalizeRepositoryPath } from '@lat.md/core/repository-path';
import { createPublicationPolicy } from './publication.js';
import { documentTreeUrls } from './document-tree.js';
import {
  documentPath,
  documentResourcePath,
  rawDocumentPath,
} from './document-route.js';
import { createViewStore, type ViewSharingPolicy } from './store.js';

/** Only literal loopback addresses retain the private, editable local UI. */
export function isLoopbackHost(host: string): boolean {
  return host === '::1' || (isIP(host) === 4 && host.startsWith('127.'));
}

// @lat: [[view/architecture#Network sharing]]
export async function createSharingPolicy(
  latDir: string,
  projectRoot: string,
  externalCa?: string | Buffer,
): Promise<ViewSharingPolicy> {
  const publicFile = await createPublicationPolicy(projectRoot);
  const preview = await createViewStore(latDir, projectRoot, {
    publishable: publicFile,
    filterMarkdown: true,
    codeExcludePaths: [projectRoot],
    git: false,
    watch: false,
    externalIgnoreLocal: true,
    externalCa,
  });
  const files = new Set<string>();
  const externalTargets = new Set<string>();
  const documents = new Set(preview.getIndex().files);
  const root = await realpath(projectRoot);
  const projectPath = (path: string) =>
    path.startsWith('@/')
      ? path.slice(2)
      : toPosix(relative(projectRoot, resolve(latDir, path)));

  const addExternal = (value: string) => {
    try {
      const target = preview.snapshot.external.parse(value);
      if (target) externalTargets.add(target.identity.split('#')[0]);
    } catch {
      /* Invalid links never grant access. */
    }
  };
  const collect = async (urls: string[], local: boolean) => {
    for (const value of urls) {
      let url: URL;
      try {
        url = new URL(value, 'http://lat.local');
      } catch {
        continue;
      }
      if (url.origin !== 'http://lat.local' || /%(?:2f|5c)/i.test(url.pathname))
        continue;
      if (url.pathname.startsWith('/external/')) {
        try {
          const [handle, ...path] = url.pathname
            .slice('/external/'.length)
            .split('/')
            .map(decodeURIComponent);
          addExternal(`${handle}:${path.join('/')}${url.hash}`);
        } catch {
          /* Invalid URL. */
        }
        continue;
      }
      // External content must never authorize a local project file.
      if (!local) continue;
      let path: string | null = null;
      let document: string | null = null;
      if (url.pathname.startsWith('/code/')) {
        try {
          path = decodeURIComponent(url.pathname.slice('/code/'.length));
        } catch {
          continue;
        }
      } else {
        const resource = documentResourcePath(url.pathname);
        document =
          documentPath(url.pathname.replace(/\/$/, '')) ??
          rawDocumentPath(url.pathname);
        if (resource) path = projectPath(resource);
        else if (document) path = projectPath(document);
      }
      if (
        !path ||
        normalizeRepositoryPath(path) !== path ||
        !(await publicFile(path))
      )
        continue;
      files.add(path);
      if (document) documents.add(document);
    }
  };

  try {
    for (const path of documents) {
      files.add(projectPath(path));
      const document = await preview.getDocument(path);
      await collect(documentTreeUrls(document.tree), true);
    }
    for (const target of externalTargets) {
      const external = await preview.getExternal(target);
      if (external.kind === 'markdown') {
        await collect(documentTreeUrls(external.document.tree), false);
      }
    }
  } finally {
    await preview.close();
  }
  return {
    externalTargets,
    async publishable(path) {
      if (!files.has(path) || !(await publicFile(path))) return false;
      // A newly introduced alias cannot expose an otherwise unlinked file.
      const actual = toPosix(
        relative(root, await realpath(resolve(projectRoot, path))),
      );
      return files.has(actual);
    },
  };
}
