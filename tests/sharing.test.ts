import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { plainStyler } from '@lat.md/core/context';
import { startViewServer, type ViewServer } from '../src/view/server.js';
import { isLoopbackHost } from '../src/view/sharing.js';
import {
  createExternalGitFixture,
  createExternalProject,
} from './external-sources/support.js';

const roots: string[] = [];
const servers: ViewServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(git: boolean, host = '0.0.0.0', gitEnabled = true) {
  const root = await mkdtemp(join(tmpdir(), 'lat-sharing-'));
  roots.push(root);
  const latDir = join(root, 'lat.md');
  const write = async (path: string, content: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  const markdown =
    '# Project\n\n[[public.ts#value]] [Preview](../README.md) ![Image](image.svg)\n\n[Hidden](../.env) [Ignored](../ignored.ts) [Untracked](../untracked.ts) [Foreign](https://example.com/code/foreign.ts) [Draft](draft.md) [New](../new.ts)\n';
  await write('lat.md/lat.md', markdown);
  await write('README.md', '# Readme\n\n[More](guides/deep.md)\n');
  await write(
    'guides/deep.md',
    '# Deep\n\n[Cycle](../README.md) [Source](../nested.ts) [Resource](../data.txt)\n',
  );
  await write('public.ts', 'export const value = "PUBLIC_SOURCE";');
  await write('nested.ts', 'export const value = "NESTED_SOURCE";');
  await write('data.txt', 'PUBLIC_RESOURCE');
  await write('lat.md/image.svg', '<svg>PUBLIC_IMAGE</svg>');
  await write('lat.md/unlinked.txt', 'PRIVATE_RESOURCE');
  await write('.env', 'PRIVATE_ENV');
  await write('ignored.ts', 'export const secret = "PRIVATE_IGNORED";');
  await write(
    'private.ts',
    '// @' + 'lat: [[lat.md/lat#Project]]\nconst secret = "PRIVATE_BACKLINK";',
  );
  await write('foreign.ts', 'const secret = "PRIVATE_FOREIGN";');
  await write(
    'secret.md',
    '# Secret\n\nPRIVATE_PREVIEW\n\n[Escalate](private.ts)',
  );
  await write('lat.md/private.md', '# Private\n\nPRIVATE_MARKDOWN\n');
  await write('lat.md/config.local.yaml', '# PRIVATE_CONFIG\n');
  await write('.gitignore', 'ignored.ts\nlat.md/private.md\nuntracked.ts\n');
  await write('client/index.html', '<html><head></head><body>UI</body></html>');
  if (git) {
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-C', root, 'add', '-f', '.']);
  }
  await write('untracked.ts', 'const secret = "PRIVATE_UNTRACKED";');
  await write('new.ts', 'NEW_SOURCE');
  await write('lat.md/draft.md', '# Draft\n\nDRAFT_MARKER\n');
  const search = vi.fn(async (query: string) => ({ query, results: [] }));
  const server = await startViewServer(
    { projectRoot: root, latDir, mode: 'cli', styler: plainStyler },
    {
      host,
      port: 0,
      watch: false,
      git: gitEnabled,
      clientDir: join(root, 'client'),
      search,
    },
  );
  servers.push(server);
  const url = new URL(server.url);
  url.hostname = '127.0.0.1';
  return {
    root,
    latDir,
    markdown,
    write,
    server,
    search,
    get: (path: string, init?: RequestInit) => fetch(new URL(path, url), init),
  };
}

// @lat: [[view/specs#Read-only network sharing]]
it.each([false, true])(
  'shares only public files reachable from the vault (Git=%s)',
  async (git) => {
    const { get, search, root, markdown } = await fixture(git);
    for (const [path, marker] of [
      ['/api/source?path=public.ts', 'PUBLIC_SOURCE'],
      ['/api/source?path=nested.ts', 'NESTED_SOURCE'],
      ['/api/document?path=@/README.md', 'Readme'],
      ['/api/document?path=@/guides/deep.md', 'Deep'],
      ['/resources/@/data.txt', 'PUBLIC_RESOURCE'],
      ['/resources/image.svg', 'PUBLIC_IMAGE'],
    ]) {
      const response = await get(path);
      expect(response.status, path).toBe(200);
      expect(await response.text()).toContain(marker);
    }
    for (const path of [
      '/api/source?path=.env',
      '/api/source?path=ignored.ts',
      '/api/source?path=untracked.ts',
      '/api/source?path=private.ts',
      '/api/source?path=foreign.ts',
      '/api/source?path=lat.md/private.md',
      '/api/source?path=lat.md/config.local.yaml',
      '/api/document?path=@/secret.md',
      '/api/document?path=private.md',
      '/api/document-source?path=private.md',
      '/private.md',
      '/resources/unlinked.txt',
      '/resources/config.local.yaml',
      '/resources/@/.env',
      '/api/source?path=public.ts%2F..%2F.env',
      '/resources/%2e%2e%2f.env',
      '/api/section?query=private.ts',
      '/api/search?query=PRIVATE',
      '/api/external?target=upstream:secret.md',
    ]) {
      const response = await get(path);
      expect(response.status, path).toBe(404);
      expect(await response.text()).not.toContain('PRIVATE_');
    }
    for (const path of [
      '/api/index',
      '/api/graph',
      '/api/document?path=lat.md',
      '/lat.md',
    ]) {
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain('PRIVATE_');
    }
    const gitState = (await (await get('/api/index')).json()).git;
    if (git) expect(gitState.files).toEqual({ 'lat.md': 'new' });
    else expect(gitState).toBeNull();
    expect(await (await get('/')).text()).toContain('lat-shared-view');
    const edit = await get('/api/document?path=lat.md', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseContent: markdown,
        content: '# Project\n\n[secret](../private.ts)',
      }),
    });
    expect(edit.status).toBe(405);
    expect(await readFile(join(root, 'lat.md/lat.md'), 'utf8')).toBe(markdown);
    expect(search).not.toHaveBeenCalled();
    expect((await get('/api/source?path=new.ts')).status).toBe(git ? 404 : 200);
    expect((await get('/api/document?path=draft.md')).status).toBe(
      git ? 404 : 200,
    );
  },
);

// @lat: [[view/specs#Shared Git diffs]]
it('shows shared Markdown diffs and polls commits without expanding file access', async () => {
  const { root, server, write, get, markdown, latDir } = await fixture(true);
  const git = (...args: string[]) =>
    execFileSync('git', [
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ]);
  await write(
    'lat.md/lat.md',
    markdown + '\nPrevious wording. [Previous source](../private.ts)\n',
  );
  git('add', 'lat.md/lat.md');
  git('commit', '-qm', 'Baseline');
  await write('lat.md/lat.md', markdown + '\nCurrent wording.\n');
  await write('lat.md/private.md', '# Private\n\nPRIVATE_CHANGED\n');
  await server.store.refresh([join(latDir, 'lat.md')]);
  expect((await (await get('/api/index')).json()).git.files).toEqual({
    'lat.md': 'modified',
  });
  const document = await (await get('/api/document?path=lat.md')).json();
  const diff = JSON.stringify(document.gitTree);
  expect(diff).toContain('git-removed');
  expect(diff).toContain('git-added');
  expect(diff).toContain('Previous');
  expect(diff).toContain('Current');
  expect(JSON.stringify(document)).not.toContain('PRIVATE_');
  expect((await get('/api/source?path=private.ts')).status).toBe(404);
  git('add', 'lat.md/lat.md');
  git('commit', '-qm', 'Update published Markdown');
  await vi.waitFor(
    () => {
      expect(server.store.getIndex().git?.files).toEqual({});
    },
    { timeout: 5000 },
  );
  expect(
    (await (await get('/api/document?path=lat.md')).json()).gitTree,
  ).toBeNull();
});

it('honors --no-git for shared listeners', async () => {
  const { get } = await fixture(true, '0.0.0.0', false);
  expect((await (await get('/api/index')).json()).git).toBeNull();
  expect(
    (await (await get('/api/document?path=lat.md')).json()).gitTree,
  ).toBeNull();
});

it('revokes removed links and new ignore rules and fails closed on refresh errors', async () => {
  const { server, get, write, latDir, markdown } = await fixture(true);
  await write('lat.md/lat.md', '# Project\n\nNo links.\n');
  await server.store.refresh([join(latDir, 'lat.md')]);
  expect((await get('/api/source?path=public.ts')).status).toBe(404);
  expect((await get('/api/document?path=@/README.md')).status).toBe(404);
  await write('lat.md/lat.md', markdown);
  await server.store.refresh([join(latDir, 'lat.md')]);
  expect((await get('/api/source?path=public.ts')).status).toBe(200);
  await write(
    '.gitignore',
    'public.ts\nlat.md/private.md\nignored.ts\nuntracked.ts\n',
  );
  await server.store.refresh(['.gitignore']);
  expect((await get('/api/source?path=public.ts')).status).toBe(404);
  await write('.gitignore', 'lat.md/\n');
  await expect(server.store.refresh(['.gitignore'])).rejects.toThrow(
    'No readable Markdown',
  );
  expect((await get('/api/index')).status).toBe(500);
  await write('.gitignore', 'lat.md/private.md\nignored.ts\nuntracked.ts\n');
  await server.store.refresh(['.gitignore']);
  expect((await get('/api/source?path=public.ts')).status).toBe(200);
});

it('rejects a shared path replaced by a symlink to an unlinked public file', async () => {
  const { root, get } = await fixture(true);
  await rm(join(root, 'public.ts'));
  await symlink(join(root, 'private.ts'), join(root, 'public.ts'));
  expect((await get('/api/source?path=public.ts')).status).toBe(404);
});

it('retains private browsing and editing only on literal loopback listeners', async () => {
  const { get } = await fixture(false, '127.0.0.1');
  expect(await (await get('/api/source?path=.env')).text()).toContain(
    'PRIVATE_ENV',
  );
  expect(await (await get('/')).text()).not.toContain('lat-shared-view');
  for (const host of ['127.0.0.1', '127.0.0.2', '::1'])
    expect(isLoopbackHost(host)).toBe(true);
  for (const host of [
    '0.0.0.0',
    '::',
    '192.168.1.2',
    'localhost',
    'docs.example',
  ])
    expect(isLoopbackHost(host)).toBe(false);
});

it('shares linked pinned external files without local overrides or local authorization', async () => {
  const upstream = await createExternalGitFixture({
    'docs/guide.md':
      '# Guide\n\nREMOTE_PUBLIC [Local](/code/private.ts) [[private.ts#secret]]\n',
    'docs/secret.md': '# Secret\n\nPRIVATE_REMOTE_UNLINKED\n',
  });
  try {
    const local = await mkdtemp(join(tmpdir(), 'lat-private-override-'));
    roots.push(local);
    await mkdir(join(local, 'docs'));
    await writeFile(
      join(local, 'docs/guide.md'),
      '# Guide\n\nPRIVATE_OVERRIDE\n',
    );
    const project = createExternalProject(upstream, {
      strategy: 'fetch',
      localPath: local,
      body: '[[upstream:guide.md]]',
    });
    roots.push(project.root);
    await writeFile(
      join(project.root, 'private.ts'),
      'export const secret = "PRIVATE_LOCAL";',
    );
    const server = await startViewServer(
      {
        projectRoot: project.root,
        latDir: project.latDir,
        mode: 'cli',
        styler: plainStyler,
      },
      {
        host: '0.0.0.0',
        port: 0,
        watch: false,
        externalCa: upstream.ca,
      },
    );
    servers.push(server);
    const url = new URL(server.url);
    url.hostname = '127.0.0.1';
    const shared = await fetch(
      new URL('/api/external?target=upstream:guide.md', url),
    );
    expect(shared.status).toBe(200);
    const content = await shared.text();
    expect(content).toContain('REMOTE_PUBLIC');
    expect(content).not.toContain('PRIVATE_');
    expect(
      (await fetch(new URL('/api/external?target=upstream:secret.md', url)))
        .status,
    ).toBe(404);
    expect(
      (await fetch(new URL('/api/source?path=private.ts', url))).status,
    ).toBe(404);
  } finally {
    await upstream.close();
  }
});
