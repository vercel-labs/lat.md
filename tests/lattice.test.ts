import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  findLatticeDir,
  listLatticeFiles,
  parseSections,
  buildFileIndex,
  resolveRef,
  flattenSections,
  extractRefs,
  findSections,
} from '@lat.md/core/lattice';
import { toPosix } from '@lat.md/core/path';

const basicDir = join(import.meta.dirname, 'cases', 'basic-project');
const basicLat = join(basicDir, 'lat.md');

describe('findLatticeDir', () => {
  it('finds .lat in the given directory', () => {
    expect(findLatticeDir(basicDir)).toBe(basicLat);
  });

  it('returns null when no .lat exists', () => {
    expect(findLatticeDir('/')).toBeNull();
  });
});

describe('listLatticeFiles', () => {
  it('lists .md files sorted alphabetically', async () => {
    const files = await listLatticeFiles(basicLat);
    expect(files).toEqual([
      join(basicLat, 'dev-process.md'),
      join(basicLat, 'notes.md'),
    ]);
  });
});

describe('parseSections', () => {
  it('handles multiple top-level headings', () => {
    const sections = parseSections('multi.md', '# First\n\n# Second\n');
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe('multi#First');
    expect(sections[1].id).toBe('multi#Second');
  });

  // @lat: [[section-parsing#Preserves rendered heading text]]
  it('preserves code, emphasis, links, images, and wiki aliases in heading identities', () => {
    const content =
      '# Guide\n\n## `foo`\n\nFirst.\n\n## **bar** and *baz* [link](https://example.com) ![image](a.png) [[target|alias]]\n\nSecond.\n';
    const sections = flattenSections(parseSections('guide.md', content));
    expect(sections.map((s) => s.id)).toEqual([
      'guide#Guide',
      'guide#Guide#foo',
      'guide#Guide#bar and baz link image alias',
    ]);
    expect(extractRefs('guide.md', content)[0].fromSection).toBe(
      sections[2].id,
    );
  });

  // @lat: [[section-parsing#Disambiguates duplicate section identities]]
  it('suffixes collisions case-insensitively and keeps descendants and references aligned', () => {
    const content =
      '# Guide\n\nIntro.\n\n## Setup\n\nFirst.\n\n## Setup-1\n\nExplicit suffix.\n\n## setup\n\nSecond [[guide#Guide#setup-2]].\n\n### **Child**\n\nChild [[guide#Guide#Setup]].\n\n## Setup\n\nThird.\n';
    const roots = parseSections('guide.md', content);
    const sections = flattenSections(roots);
    expect(sections.map((s) => s.id)).toEqual([
      'guide#Guide',
      'guide#Guide#Setup',
      'guide#Guide#Setup-1',
      'guide#Guide#setup-2',
      'guide#Guide#setup-2#Child',
      'guide#Guide#Setup-3',
    ]);
    expect(sections[3].heading).toBe('setup');
    expect(extractRefs('guide.md', content).map((r) => r.fromSection)).toEqual([
      'guide#Guide#setup-2',
      'guide#Guide#setup-2#Child',
    ]);
    for (const section of sections)
      expect(findSections(roots, section.id)[0].section.startLine).toBe(
        section.startLine,
      );
    expect(findSections(roots, 'guide#Guide#setup-2#child')[0].section.id).toBe(
      'guide#Guide#setup-2#Child',
    );
    expect(
      flattenSections(parseSections('guide.md', content)).map((s) => s.id),
    ).toEqual(sections.map((s) => s.id));
  });

  it('uses file stem without .md extension', () => {
    const sections = parseSections('/path/to/notes.md', '# Hello');
    expect(sections[0].file).toBe('notes');
  });
});

describe('toPosix', () => {
  it('converts native backslash separators to forward slashes', () => {
    expect(toPosix('codigo\\codigo.md')).toBe('codigo/codigo.md');
    expect(toPosix('lat.md\\codigo\\a')).toBe('lat.md/codigo/a');
  });

  it('leaves POSIX paths unchanged', () => {
    expect(toPosix('lat.md/codigo/a')).toBe('lat.md/codigo/a');
    expect(toPosix('notes')).toBe('notes');
    expect(toPosix('')).toBe('');
  });
});

// Regression guard for issue #69: on Windows, section file paths kept the
// native `\` separator, so bare-name (`[[a]]`) links in a directory-index file
// never resolved. Section paths are now normalized to POSIX at construction, so
// this scenario resolves identically on every OS. The windows-latest CI job
// runs this same test on the platform where the bug originally manifested.
describe('bare-name link resolution in a subdirectory (issue #69)', () => {
  const root = join('/tmp', 'proj');
  const parse = (rel: string, body: string) =>
    parseSections(join(root, 'lat.md', rel), body, root);

  it('resolves short-form links to sibling files in the same subdir', () => {
    const sections = [
      ...parse('codigo/a.md', '# A\n\nAlpha.\n'),
      ...parse('codigo/b.md', '# B\n\nBravo.\n'),
      ...parse('codigo/codigo.md', '# Codigo\n\nDirectory index.\n'),
    ];

    // The invariant the fix enforces: stored paths are POSIX on every platform.
    expect(sections.map((s) => s.file)).toContain('lat.md/codigo/a');
    expect(sections.every((s) => !s.file.includes('\\'))).toBe(true);

    const fileIndex = buildFileIndex(sections);
    const sectionIds = new Set(sections.map((s) => s.id.toLowerCase()));

    for (const name of ['a', 'b']) {
      const { resolved, ambiguous } = resolveRef(name, sectionIds, fileIndex);
      expect(ambiguous).toBeNull();
      expect(sectionIds.has(resolved.toLowerCase())).toBe(true);
    }
  });
});
