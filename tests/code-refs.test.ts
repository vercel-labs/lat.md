import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkCodeRefs } from '@lat.md/core/cli/check';
import { parse } from '@lat.md/core/parser';
import { visit } from 'unist-util-visit';
import {
  createCodeReferenceDiscovery,
  extractCodeRefTargets,
  discoverSourceFiles,
  hasRipgrep,
  scanCodeRefs,
  type ScanResult,
} from '@lat.md/core/code-refs';
import {
  isSourceFilePath,
  SOURCE_FILE_EXTENSIONS,
} from '@lat.md/core/source-formats';

const roots: string[] = [];

function codeReference(comment: string, target: string): string {
  return `${comment} @${'lat'}: [[${target}]]\n`;
}

describe('code-reference target boundaries', () => {
  // @lat: [[check-code-refs#Parses balanced targets without a nesting limit]]
  it.each([
    'routes#[region] pages',
    'routes#Routes#[[...slug]] catch-all',
    'types#list[dict[str, list[int]]]',
    `types#${'['.repeat(64)}value${']'.repeat(64)}`,
    'routes#Plain',
    'routes#[id]|display text',
    'routes#Plain|literal [ alias',
  ])('agrees with wiki-link boundaries for %s', (target) => {
    const wikiTargets: string[] = [];
    visit(parse(`[[${target}]]`), 'wikiLink', (node) => {
      wikiTargets.push(
        node.value + (node.data.alias ? `|${node.data.alias}` : ''),
      );
    });
    expect(wikiTargets).toEqual([target]);
    for (const comment of ['//', '#']) {
      const line = codeReference(comment, target).trimEnd();
      expect(extractCodeRefTargets(line)).toEqual(wikiTargets);
      expect(
        extractCodeRefTargets(`${line} ${codeReference(comment, 'other')}`),
      ).toEqual([target, 'other']);
    }
  });

  // @lat: [[check-code-refs#Rejects incomplete code-reference targets]]
  it.each([
    '',
    ' ',
    'target[unclosed',
    'target]suffix',
    'target\nnext',
    'target\rnext',
    '|alias',
    'target|',
  ])(
    'ignores malformed target %j without losing the next reference',
    (target) => {
      const malformed = codeReference('//', target).trimEnd();
      expect(extractCodeRefTargets(malformed)).toEqual([]);
      expect(
        extractCodeRefTargets(`${malformed} ${codeReference('#', 'valid')}`),
      ).toEqual(['valid']);
    },
  );
});

async function createSourceProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lat-code-refs-'));
  const sourceDir = join(root, 'src');
  await mkdir(sourceDir);
  roots.push(root);

  await Promise.all([
    ...SOURCE_FILE_EXTENSIONS.map((extension) => {
      const comment = extension === '.py' ? '#' : '//';
      return writeFile(
        join(sourceDir, `source${extension}`),
        codeReference(comment, `Specs#${extension.slice(1)}`),
      );
    }),
    writeFile(
      join(sourceDir, 'unsupported.txt'),
      codeReference('//', 'Specs#unsupported'),
    ),
  ]);
  return root;
}

function expectRegisteredSourcesOnly(
  scan: ScanResult,
  sourceFiles: string[],
): void {
  expect(scan.refs.map((ref) => ref.file).sort()).toEqual(
    SOURCE_FILE_EXTENSIONS.map((extension) => `src/source${extension}`).sort(),
  );
  expect(scan.refs.some((ref) => ref.target === 'Specs#unsupported')).toBe(
    false,
  );
  expect(sourceFiles.some((file) => file.endsWith('unsupported.txt'))).toBe(
    false,
  );
  expect(sourceFiles.every(isSourceFilePath)).toBe(true);
  expect(sourceFiles).toHaveLength(SOURCE_FILE_EXTENSIONS.length);
}

function relativeFiles(root: string, files: string[]): string[] {
  return files.map((file) => relative(root, file).replaceAll('\\', '/'));
}

function comparableRefs(scan: ScanResult): string[] {
  return scan.refs.map((ref) => `${ref.file}:${ref.line}:${ref.target}`);
}

async function createDiscoveryParityProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lat-discovery-parity-'));
  roots.push(root);

  const directories = [
    'src',
    'ignored',
    'caseignored',
    'nested/blocked',
    'pruned/dropped',
    'pruned/reincluded',
    '.hidden',
    'generated',
    'node_modules/highlight.js',
    'packages/example/node_modules/highlight.js',
    'subproject/lat.md',
    'subproject/src',
  ];
  await Promise.all(
    directories.map((directory) =>
      mkdir(join(root, directory), { recursive: true }),
    ),
  );

  await Promise.all([
    writeFile(
      join(root, '.gitignore'),
      [
        'ignored/',
        'CaseIgnored/',
        '*.tmp.ts',
        '!kept.tmp.ts',
        'pruned/*',
        '!pruned/reincluded/',
      ].join('\n'),
    ),
    writeFile(
      join(root, 'nested', '.gitignore'),
      ['blocked/', '*.skip.ts', '!kept.skip.ts'].join('\n'),
    ),
    writeFile(join(root, 'plain.txt'), 'visible unsupported file\n'),
    writeFile(
      join(root, 'src', 'visible.ts'),
      codeReference('//', 'Specs#visible'),
    ),
    writeFile(
      join(root, 'src', 'ignored.tmp.ts'),
      codeReference('//', 'Specs#ignored temporary'),
    ),
    writeFile(
      join(root, 'src', 'kept.tmp.ts'),
      codeReference('//', 'Specs#kept temporary'),
    ),
    writeFile(
      join(root, 'ignored', 'ignored.ts'),
      codeReference('//', 'Specs#ignored directory'),
    ),
    writeFile(
      join(root, 'caseignored', 'ignored.ts'),
      codeReference('//', 'Specs#case-insensitive ignore'),
    ),
    writeFile(
      join(root, 'nested', 'visible.ts'),
      codeReference('//', 'Specs#nested visible'),
    ),
    writeFile(
      join(root, 'nested', 'discard.skip.ts'),
      codeReference('//', 'Specs#nested ignored'),
    ),
    writeFile(
      join(root, 'nested', 'kept.skip.ts'),
      codeReference('//', 'Specs#nested kept'),
    ),
    writeFile(
      join(root, 'nested', 'blocked', 'ignored.ts'),
      codeReference('//', 'Specs#nested blocked'),
    ),
    writeFile(
      join(root, 'pruned', 'dropped', 'ignored.ts'),
      codeReference('//', 'Specs#pruned'),
    ),
    writeFile(
      join(root, 'pruned', 'reincluded', 'kept.ts'),
      codeReference('//', 'Specs#reincluded'),
    ),
    writeFile(
      join(root, '.hidden', 'ignored.ts'),
      codeReference('//', 'Specs#hidden'),
    ),
    writeFile(
      join(root, 'generated', 'visible.ts'),
      codeReference('//', 'Specs#generated'),
    ),
    writeFile(
      join(root, 'node_modules', 'highlight.js', 'ignored.ts'),
      codeReference('//', 'Specs#root dependency'),
    ),
    writeFile(
      join(
        root,
        'packages',
        'example',
        'node_modules',
        'highlight.js',
        'ignored.ts',
      ),
      codeReference('//', 'Specs#nested dependency'),
    ),
    writeFile(join(root, 'subproject', 'lat.md', 'specs.md'), '# Specs\n'),
    writeFile(
      join(root, 'subproject', 'src', 'ignored.ts'),
      codeReference('//', 'Specs#subproject'),
    ),
  ]);

  if (process.platform !== 'win32') {
    await symlink('src/visible.ts', join(root, 'linked.ts'));
  }

  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('supported source code-reference scanning', () => {
  // @lat: [[check-code-refs#Scans only supported source files]]
  it('drives ripgrep and TypeScript scans from the source extension registry', async () => {
    const root = await createSourceProject();
    const original = process.env._LAT_DISABLE_RG;

    try {
      delete process.env._LAT_DISABLE_RG;
      const rgAvailable = await hasRipgrep();
      const scanOperations: string[] = [];
      const [preferred, preferredFiles] = await Promise.all([
        scanCodeRefs(root, {
          async time<T>(label: string, work: () => Promise<T>): Promise<T> {
            scanOperations.push(label);
            return work();
          },
        }),
        discoverSourceFiles(root),
      ]);
      expectRegisteredSourcesOnly(preferred, preferredFiles);
      if (rgAvailable) {
        expect(scanOperations).toContain('scan @lat references with ripgrep');
        expect(scanOperations).toContain('list source files with ripgrep');
      }

      process.env._LAT_DISABLE_RG = '1';
      const [fallback, fallbackFiles] = await Promise.all([
        scanCodeRefs(root),
        discoverSourceFiles(root),
      ]);
      expectRegisteredSourcesOnly(fallback, fallbackFiles);
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });

  it('scans PHP line comments without matching attributes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lat-php-code-refs-'));
    roots.push(root);
    await mkdir(join(root, 'app'));
    await writeFile(
      join(root, 'app', 'Example.php'),
      `<?php
// @lat: [[tests/php-source-parser#PHP Source Parser#Scans PHP line comments without matching attributes]]
# @lat: [[tests/php-source-parser#PHP Source Parser#Scans PHP line comments without matching attributes]]
#[Attribute]
`,
    );

    const expected = [
      'app/Example.php:2:tests/php-source-parser#PHP Source Parser#Scans PHP line comments without matching attributes',
      'app/Example.php:3:tests/php-source-parser#PHP Source Parser#Scans PHP line comments without matching attributes',
    ];
    const original = process.env._LAT_DISABLE_RG;
    try {
      // Exercise PHP through the TypeScript fallback; the registry test covers ripgrep.
      process.env._LAT_DISABLE_RG = '1';
      const { refs } = await scanCodeRefs(root);
      expect(
        refs.map((ref) => `${ref.file}:${ref.line}:${ref.target}`),
      ).toEqual(expected);
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });

  // @lat: [[check-code-refs#Scans bracketed required-section targets]]
  it('validates bracketed required mentions through ripgrep and the fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lat-bracketed-code-refs-'));
    roots.push(root);
    await mkdir(join(root, 'lat.md'));
    await mkdir(join(root, 'src'));
    const headings = [
      '[region] pages',
      '[[...slug]] catch-all',
      'list[dict[str, list[int]]]',
    ];
    await writeFile(
      join(root, 'lat.md', 'routes.md'),
      '---\nlat:\n  require-code-mention: true\n---\n# Routes\n\nRoute specs.\n\n' +
        headings
          .map((heading) => `## \`${heading}\`\n\nRoute behavior.\n`)
          .join('\n'),
    );
    const targets = headings.map((heading) => `routes#Routes#${heading}`);
    const source = join(root, 'src', 'routes.ts');
    const original = process.env._LAT_DISABLE_RG;
    const rgAvailable = await hasRipgrep();
    try {
      for (const disableRipgrep of [false, true]) {
        if (disableRipgrep) process.env._LAT_DISABLE_RG = '1';
        else delete process.env._LAT_DISABLE_RG;
        await writeFile(
          source,
          targets.map((target) => codeReference('//', target)).join(''),
        );
        const operations: string[] = [];
        const { refs } = await scanCodeRefs(root, {
          async time(label, work) {
            operations.push(label);
            return work();
          },
        });
        expect(refs).toEqual(
          targets.map((target, index) => ({
            target,
            file: 'src/routes.ts',
            line: index + 1,
          })),
        );
        if (!disableRipgrep && rgAvailable) {
          expect(operations).toContain('scan @lat references with ripgrep');
        } else {
          expect(operations).toContain(
            'scan project files with TypeScript fallback',
          );
        }
        expect(
          (await checkCodeRefs(join(root, 'lat.md'), root)).errors,
        ).toEqual([]);

        await writeFile(
          source,
          targets
            .slice(1)
            .map((target) => codeReference('//', target))
            .join(''),
        );
        const missing = (await checkCodeRefs(join(root, 'lat.md'), root))
          .errors;
        expect(missing).toHaveLength(1);
        expect(missing[0].message).toContain(
          'requires a code mention but none found',
        );
        expect(missing[0].target).toBe(`lat.md/${targets[0]}`);

        await writeFile(
          source,
          targets.map((target) => codeReference('//', target)).join('') +
            codeReference('//', 'routes#Missing[nested[value]]'),
        );
        const dangling = (await checkCodeRefs(join(root, 'lat.md'), root))
          .errors;
        expect(dangling).toHaveLength(1);
        expect(dangling[0].target).toBe('routes#Missing[nested[value]]');
        expect(dangling[0].message).toContain('no matching section found');
      }
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });

  // @lat: [[tests/ts-fallback#Bounded pool preserves source order]]
  it('preserves source order across a saturated TypeScript scan pool', async () => {
    const root = await createSourceProject();
    await Promise.all(
      Array.from({ length: availableParallelism() + 1 }, (_, index) =>
        writeFile(
          join(root, 'src', `ordered-${index.toString().padStart(2, '0')}.ts`),
          codeReference('//', `Specs#ordered-${index}`),
        ),
      ),
    );
    const original = process.env._LAT_DISABLE_RG;

    try {
      process.env._LAT_DISABLE_RG = '1';
      const discovery = createCodeReferenceDiscovery(root);
      const [scan, sourceFiles] = await Promise.all([
        discovery.scan(),
        discovery.listSourceFiles(),
      ]);
      const sourceOrder = sourceFiles.map((file) =>
        relative(root, file).replaceAll('\\', '/'),
      );
      expect(scan.refs.map((ref) => ref.file)).toEqual(sourceOrder);
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });

  // @lat: [[tests/ts-fallback#Matches ripgrep discovery semantics]]
  it('keeps TypeScript and ripgrep discovery semantics in lockstep', async () => {
    const root = await createDiscoveryParityProject();
    const original = process.env._LAT_DISABLE_RG;

    try {
      process.env._LAT_DISABLE_RG = '1';
      const fallbackDiscovery = createCodeReferenceDiscovery(root);
      const [fallback, fallbackFiles] = await Promise.all([
        fallbackDiscovery.scan(),
        fallbackDiscovery.listSourceFiles(),
      ]);
      expect(relativeFiles(root, fallbackFiles)).toEqual([
        'generated/visible.ts',
        'nested/kept.skip.ts',
        'nested/visible.ts',
        'pruned/reincluded/kept.ts',
        'src/kept.tmp.ts',
        'src/visible.ts',
      ]);

      delete process.env._LAT_DISABLE_RG;
      if (!(await hasRipgrep())) return;
      const preferredDiscovery = createCodeReferenceDiscovery(root);
      const [preferred, preferredFiles] = await Promise.all([
        preferredDiscovery.scan(),
        preferredDiscovery.listSourceFiles(),
      ]);
      expect(relativeFiles(root, preferredFiles)).toEqual(
        relativeFiles(root, fallbackFiles),
      );
      expect(comparableRefs(preferred)).toEqual(comparableRefs(fallback));
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });

  // @lat: [[tests/ts-fallback#Git repositories scan tracked sources]]
  it('uses the same tracked source scope with ripgrep and TypeScript', async () => {
    const root = await createDiscoveryParityProject();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync(
      'git',
      [
        'add',
        '.gitignore',
        'nested/.gitignore',
        '.hidden/ignored.ts',
        'nested/visible.ts',
        'src/visible.ts',
        'subproject/lat.md/specs.md',
        'subproject/src/ignored.ts',
      ],
      { cwd: root },
    );
    const symlinkBlob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: root,
      encoding: 'utf8',
      input: 'src/visible.ts\n',
    }).trim();
    execFileSync(
      'git',
      [
        'update-index',
        '--add',
        '--cacheinfo',
        `120000,${symlinkBlob},linked.ts`,
      ],
      { cwd: root },
    );
    const original = process.env._LAT_DISABLE_RG;

    try {
      process.env._LAT_DISABLE_RG = '1';
      const fallbackDiscovery = createCodeReferenceDiscovery(root);
      const [fallback, fallbackFiles] = await Promise.all([
        fallbackDiscovery.scan(),
        fallbackDiscovery.listSourceFiles(),
      ]);
      expect(relativeFiles(root, fallbackFiles)).toEqual([
        'nested/visible.ts',
        'src/visible.ts',
      ]);

      delete process.env._LAT_DISABLE_RG;
      const preferredDiscovery = createCodeReferenceDiscovery(root);
      const [preferred, preferredFiles] = await Promise.all([
        preferredDiscovery.scan(),
        preferredDiscovery.listSourceFiles(),
      ]);
      expect(relativeFiles(root, preferredFiles)).toEqual(
        relativeFiles(root, fallbackFiles),
      );
      expect(comparableRefs(preferred)).toEqual(comparableRefs(fallback));
    } finally {
      if (original === undefined) delete process.env._LAT_DISABLE_RG;
      else process.env._LAT_DISABLE_RG = original;
    }
  });
});
