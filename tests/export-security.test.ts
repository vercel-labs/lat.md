import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { plainStyler } from '@lat.md/core/context';
import { buildStaticView } from '../src/view/static-build.js';
import { createViewStore } from '../src/view/store.js';
import {
  createExternalGitFixture,
  createExternalProject,
} from './external-sources/support.js';
import { documentTreeToHtml } from './document-tree.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function client(root: string) {
  const directory = join(root, 'client');
  await mkdir(directory);
  await writeFile(
    join(directory, 'index.html'),
    '<html><head></head><body>Export</body></html>',
  );
  return directory;
}
async function fixture(git = false) {
  const root = await mkdtemp(join(tmpdir(), 'lat-export-security-'));
  roots.push(root);
  const latDir = join(root, 'lat.md');
  await mkdir(latDir);
  const clientDir = await client(root);
  if (git) execFileSync('git', ['init', '-q', root]);
  return {
    root,
    latDir,
    clientDir,
    context: {
      projectRoot: root,
      latDir,
      styler: plainStyler,
      mode: 'cli' as const,
    },
  };
}
async function artifact(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? artifact(join(root, entry.name))
          : readFile(join(root, entry.name), 'utf8'),
      ),
    )
  ).join('\n');
}

// @lat: [[view/specs#Export publication boundaries]]
it.each([false, true])(
  'rejects private source and resource exports (Git=%s)',
  async (git) => {
    const { root, latDir, clientDir, context } = await fixture(git);
    await writeFile(join(root, '.env'), 'PRIVATE_ENV_MARKER');
    await writeFile(join(root, 'ignored.ts'), 'PRIVATE_IGNORED_MARKER');
    await writeFile(join(root, '.gitignore'), 'ignored.ts\n');
    await writeFile(
      join(latDir, 'config.local.yaml'),
      '# PRIVATE_LOCAL_CONFIG_MARKER\n',
    );
    await writeFile(
      join(latDir, 'CONFIG.LOCAL.YAML'),
      '# PRIVATE_CASE_MARKER\n',
    );
    await mkdir(join(latDir, '.cache'));
    await writeFile(
      join(latDir, '.cache', 'secret.json'),
      'PRIVATE_CACHE_MARKER',
    );
    for (const href of [
      '/code/.env',
      '/code/ignored.ts',
      '/resources/config.local.yaml',
      '/resources/CONFIG.LOCAL.YAML',
      '/resources/.cache/secret.json',
    ]) {
      await writeFile(
        join(latDir, 'lat.md'),
        `# Project\n\n[secret](${href})\n`,
      );
      await expect(
        buildStaticView(context, join(root, 'out'), { clientDir }),
      ).rejects.toThrow('excluded from publication');
    }
    // A visible symlink must not turn an excluded file into a public resource.
    await symlink(
      join(latDir, 'config.local.yaml'),
      join(latDir, 'alias.yaml'),
    );
    await writeFile(
      join(latDir, 'lat.md'),
      '# Project\n\n[alias](alias.yaml)\n',
    );
    await expect(
      buildStaticView(context, join(root, 'out'), { clientDir }),
    ).rejects.toThrow('excluded from publication');
  },
);

it.each([false, true])(
  'exports ordinary files but ignores foreign origins and encoded traversal (Git=%s)',
  async (git) => {
    const { root, latDir, clientDir, context } = await fixture(git);
    await writeFile(join(root, '.env'), 'PRIVATE_ENV_MARKER');
    await writeFile(
      join(root, 'public.ts'),
      'export const value = "PUBLIC_SOURCE_MARKER";',
    );
    await writeFile(
      join(latDir, 'image.svg'),
      '<svg>PUBLIC_RESOURCE_MARKER</svg>',
    );
    await writeFile(
      join(latDir, 'lat.md'),
      '# Project\n\n[Source](../public.ts) [Image](image.svg) [Foreign](https://example.invalid/code/.env) [Escape](/code/public.ts%2F..%2F..%2Fescaped)\n',
    );
    if (git)
      execFileSync('git', ['-C', root, 'add', '--', 'public.ts', 'lat.md']);
    const output = join(root, 'out');
    await buildStaticView(context, output, { clientDir });
    const content = await artifact(output);
    expect(content).toContain('PUBLIC_SOURCE_MARKER');
    expect(content).toContain('PUBLIC_RESOURCE_MARKER');
    expect(content).not.toContain('PRIVATE_ENV_MARKER');
    expect(await readdir(root)).not.toContain('escaped');
    if (git) {
      await writeFile(join(root, 'untracked.ts'), 'PRIVATE_UNTRACKED_MARKER');
      await writeFile(
        join(latDir, 'lat.md'),
        '# Project\n\n[Untracked](../untracked.ts)\n',
      );
      await expect(
        buildStaticView(context, output, { clientDir, force: true }),
      ).rejects.toThrow('excluded from publication');
      expect(await artifact(output)).toBe(content); // Failed builds preserve the prior artifact.
    }
  },
);

it('filters ignored code backlinks before rendering their snippets', async () => {
  const { root, latDir, clientDir, context } = await fixture(true);
  await writeFile(
    join(latDir, 'lat.md'),
    '# Project\n\nPublic documentation.\n',
  );
  await writeFile(
    join(root, 'private.ts'),
    `// @${'lat'}: [[lat.md/lat#Project]]\nconst secret = 'PRIVATE_BACKLINK_MARKER';`,
  );
  await writeFile(join(root, '.gitignore'), 'private.ts\n');
  execFileSync('git', [
    '-C',
    root,
    'add',
    '--force',
    'private.ts',
    '.gitignore',
    'lat.md',
  ]);
  await buildStaticView(context, join(root, 'out'), { clientDir });
  expect(await artifact(join(root, 'out'))).not.toContain(
    'PRIVATE_BACKLINK_MARKER',
  );
});

// @lat: [[view/specs#External documents cannot publish local source]]
it('keeps external Markdown and AsciiDoc from authorizing local reads', async () => {
  const external = await createExternalGitFixture({
    'docs/attack.md':
      '# Remote\n\n[Local](/code/private.ts) [[private.ts#secret]]\n',
    'docs/attack.adoc': '= Remote\n\nlink:/code/private.ts[Local]\n',
  });
  try {
    const project = createExternalProject(external, {
      strategy: 'fetch',
      body: 'Read [[upstream:attack.md]] and [[upstream:attack.adoc]].',
    });
    roots.push(project.root);
    await writeFile(
      join(project.root, 'private.ts'),
      'export const secret = "PRIVATE_EXTERNAL_MARKER";',
    );
    const clientDir = await client(project.root);
    const store = await createViewStore(project.latDir, project.root, {
      watch: false,
      git: false,
      externalCa: external.ca,
    });
    try {
      for (const target of ['upstream:attack.md', 'upstream:attack.adoc']) {
        const document = await store.getExternal(target);
        expect(document.kind).toBe('markdown');
        if (document.kind === 'markdown')
          expect(documentTreeToHtml(document.document.tree)).not.toContain(
            'href="/code/',
          );
      }
    } finally {
      await store.close();
    }
    const output = join(project.root, 'out');
    await buildStaticView(
      {
        ...project,
        projectRoot: project.root,
        styler: plainStyler,
        mode: 'cli',
      },
      output,
      { clientDir, externalCa: external.ca },
    );
    expect(await artifact(output)).not.toContain('PRIVATE_EXTERNAL_MARKER');
  } finally {
    await external.close();
  }
});
