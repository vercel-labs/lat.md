import { afterEach, expect, it } from 'vitest';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { plainStyler } from '@lat.md/core/context';
import { createViewStore } from '../src/view/store.js';
import { startViewServer } from '../src/view/server.js';
import { buildStaticView } from '../src/view/static-build.js';
import {
  documentPath,
  documentUrl,
  validateDocumentRoutes,
} from '../src/view/document-route.js';
import { rewriteLocalFileLink } from '../src/view/source-target.js';
import { documentTreeToHtml } from './document-tree.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lat-project-doc-'));
  roots.push(root);
  const latDir = join(root, 'lat.md');
  const clientDir = join(root, 'client');
  await mkdir(latDir);
  await mkdir(clientDir);
  await mkdir(join(root, 'guide'));
  await writeFile(
    join(clientDir, 'index.html'),
    '<html><head></head><body>Shell</body></html>',
  );
  await writeFile(
    join(latDir, 'lat.md'),
    '# Home\n\n[Project readme](../README.md#installation)\n\n[Vault readme](README.md)\n',
  );
  await writeFile(
    join(latDir, 'README.md'),
    '# Vault readme\n\nVault content.\n',
  );
  await writeFile(
    join(root, 'README.md'),
    '# Project readme\n\nProject content.\n\n## Installation\n\n[Next](guide/my%20guide.md#details)\n\n![Logo](guide/logo.svg)\n\n<p align="center"><a href="guide/my%20guide.md#details"><img src="guide/html-logo.svg" alt="HTML logo" width="500"></a></p>\n\n[Home](lat.md/lat.md)\n',
  );
  await writeFile(
    join(root, 'guide/my guide.md'),
    '# Guide\n\n## Details\n\n[Back](../README.md#installation)\n',
  );
  await writeFile(
    join(root, 'guide/logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );
  await writeFile(
    join(root, 'guide/html-logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );
  return {
    root,
    latDir,
    clientDir,
    ctx: {
      projectRoot: root,
      latDir,
      styler: plainStyler,
      mode: 'cli' as const,
      headless: true,
    },
  };
}

// @lat: [[view/specs#Previews project Markdown]]
it('keeps project and vault identities separate in live and static documents', async () => {
  const { root, latDir, clientDir, ctx } = await fixture();
  expect(rewriteLocalFileLink('../README.md#installation', 'lat.md')).toBe(
    '/@/README.md#installation',
  );
  expect(
    rewriteLocalFileLink('../../guide/my%20guide.md#details', 'nested/page.md'),
  ).toBe('/@/guide/my%20guide.md#details');
  expect(documentPath('/@/guide/my%20guide.md')).toBe('@/guide/my guide.md');
  expect(documentUrl('@/guide/my guide.md')).toBe('/@/guide/my%20guide.md');
  const store = await createViewStore(latDir, root, {
    watch: false,
    git: false,
  });
  try {
    const preview = await store.getDocument('@/README.md');
    expect(documentTreeToHtml(preview.tree)).toContain('Project content');
    expect(documentTreeToHtml(preview.tree)).toContain(
      '/@/guide/my%20guide.md#details',
    );
    expect(documentTreeToHtml(preview.tree)).toContain(
      '/resources/%40/guide/logo.svg',
    );
    expect(documentTreeToHtml(preview.tree)).toContain(
      'src="/resources/%40/guide/html-logo.svg"',
    );
    expect(documentTreeToHtml(preview.tree)).toContain('href="/lat"');
    expect(
      preview.tableOfContents.some((heading) => heading.id === 'installation'),
    ).toBe(true);
    expect(
      documentTreeToHtml((await store.getDocument('README.md')).tree),
    ).toContain('Vault content');
    expect(store.getIndex().files).not.toContain('@/README.md');
    await expect(store.getDocumentSource('@/README.md')).rejects.toThrow();
  } finally {
    await store.close();
  }
  const server = await startViewServer(ctx, {
    port: 0,
    clientDir,
    watch: false,
    git: false,
  });
  try {
    expect((await fetch(new URL('/@/README.md', server.url))).status).toBe(200);
    const response = await fetch(
      new URL('/api/document?path=%40%2FREADME.md', server.url),
    );
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain('Project content');
    expect(
      (await fetch(new URL('/resources/%40/guide/logo.svg', server.url)))
        .status,
    ).toBe(200);
  } finally {
    await server.close();
  }
  for (const basePath of ['/', '/docs/']) {
    const output = join(root, basePath === '/' ? 'out-root' : 'out-docs');
    await buildStaticView(ctx, output, { clientDir, basePath });
    const payload = basePath === '/' ? output : join(output, 'docs');
    const manifest = JSON.parse(
      await readFile(join(payload, 'data/manifest.json'), 'utf8'),
    );
    expect(Object.keys(manifest.documents).sort()).toEqual([
      '@/README.md',
      '@/guide/my guide.md',
      'README.md',
      'lat.md',
    ]);
    const preview = JSON.parse(
      await readFile(join(payload, manifest.documents['@/README.md']), 'utf8'),
    );
    expect(documentTreeToHtml(preview.tree)).toContain(
      basePath + '@/guide/my%20guide.md#details',
    );
    expect(
      await readFile(join(payload, '@/README.md/index.html'), 'utf8'),
    ).toContain('Project content');
    expect(
      await readFile(join(payload, 'resources/@/guide/logo.svg'), 'utf8'),
    ).toContain('<svg');
    expect(
      await readFile(join(payload, 'resources/@/guide/html-logo.svg'), 'utf8'),
    ).toContain('<svg');
    const app = express();
    app.use(express.static(output));
    const host = createServer(app);
    await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
    try {
      const origin = 'http://127.0.0.1:' + (host.address() as AddressInfo).port;
      const response = await fetch(origin + basePath + '@/README.md');
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain('Project content');
    } finally {
      await new Promise<void>((resolve, reject) =>
        host.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
});

// @lat: [[view/specs#Constrains project Markdown previews]]
it('reserves @ and enforces project and publication boundaries for previews', async () => {
  const { root, latDir, ctx, clientDir } = await fixture();
  for (const path of ['@/README.md', 'nested/@/file.md', 'name@host.md']) {
    expect(() => validateDocumentRoutes([path])).toThrow('conflicts');
  }
  const outside = await mkdtemp(join(tmpdir(), 'lat-project-outside-'));
  roots.push(outside);
  await writeFile(join(outside, 'secret.md'), '# Outside\n');
  await symlink(join(outside, 'secret.md'), join(root, 'escape.md'));
  const store = await createViewStore(latDir, root, {
    watch: false,
    git: false,
  });
  try {
    for (const path of [
      '@/../secret.md',
      '@/escape.md',
      '@/name@host.md',
      '@/guide/../../secret.md',
    ]) {
      await expect(store.getDocument(path)).rejects.toThrow();
    }
    await expect(store.getDocumentResource('@/escape.md')).rejects.toThrow();
    await symlink(join(outside, 'secret.md'), join(root, 'escape.svg'));
    await expect(store.getDocumentResource('@/escape.svg')).rejects.toThrow();
  } finally {
    await store.close();
  }
  await writeFile(join(root, '.private.md'), '# Private\n');
  await writeFile(
    join(latDir, 'lat.md'),
    '# Home\n\n[Private](../.private.md)\n',
  );
  await expect(
    buildStaticView(ctx, join(root, 'private-output'), { clientDir }),
  ).rejects.toThrow('excluded from publication');
});
