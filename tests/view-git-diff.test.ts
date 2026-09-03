// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { buildGitDiffTree } from '../src/view/git-diff.js';
import { renderMarkdown } from '../src/view/markdown.js';
import { documentTreeToHtml } from './document-tree.js';

async function renderDiff(before: string, after: string): Promise<HTMLElement> {
  const rendered = await renderMarkdown(
    after,
    'lat.md',
    (target) => ({ href: `/docs/${target}`, referenceCount: 0 }),
    {},
    buildGitDiffTree(before, after),
  );
  const container = document.createElement('div');
  container.innerHTML = documentTreeToHtml(rendered.tree);
  return container;
}

describe('rendered Git list diffs', () => {
  // @lat: [[lat.md/knowledge/view/specs#View Tests#Keeps rendered list diffs distinct]]
  it.each([
    ['tight unordered', '-', '\n'],
    ['loose unordered', '-', '\n\n'],
    ['tight ordered', '1.', '\n'],
    ['loose ordered', '1.', '\n\n'],
  ])(
    'keeps replacements separate in %s lists',
    async (_, marker, separator) => {
      const docs =
        '[[docs]] — Concise documentation for installing, using, and integrating Lat';
      const quickStart =
        '[[quick-start]] — Set up Lat and let your agent maintain the graph';
      const changelog = '[[changelog]] — User-visible changes by release';
      const knowledge = '[[knowledge]] — The internal knowledge graph';
      const list = (items: string[]) =>
        items.map((item) => `${marker} ${item}`).join(separator);
      const rendered = await renderDiff(
        list([docs, changelog, knowledge]),
        list([quickStart, changelog, docs, knowledge]),
      );
      const items = [...rendered.querySelectorAll('li')];

      expect(items.map((item) => item.querySelector('a')?.textContent)).toEqual(
        ['docs', 'quick-start', 'changelog', 'docs', 'knowledge'],
      );
      expect(items.map((item) => item.className)).toEqual([
        'git-removed',
        'git-added',
        '',
        'git-added',
        '',
      ]);
      expect(items.map((item) => item.querySelectorAll('a').length)).toEqual([
        1, 1, 1, 1, 1,
      ]);
      expect(items[0].textContent?.trim()).toBe(
        docs.replace('[[docs]]', 'docs'),
      );
      expect(items[1].textContent?.trim()).toBe(
        quickStart.replace('[[quick-start]]', 'quick-start'),
      );
    },
  );

  it.each(['-', '1.', '- [ ]'])(
    'keeps small edits inline in %s list items',
    async (marker) => {
      const rendered = await renderDiff(
        `${marker} The [old link](guide.md) stays clickable.`,
        `${marker} The [new link](guide.md) stays clickable.`,
      );
      expect(rendered.querySelectorAll('li')).toHaveLength(1);
      expect(
        rendered.querySelector('li')?.classList.contains('git-added'),
      ).toBe(false);
      expect(
        rendered.querySelector('li')?.classList.contains('git-removed'),
      ).toBe(false);
      expect(rendered.querySelector('del.git-removed a')?.textContent).toBe(
        'old',
      );
      expect(rendered.querySelector('ins.git-added a')?.textContent).toBe(
        'new',
      );
      expect(rendered.querySelector('ins a')?.getAttribute('href')).toBe(
        'guide.md',
      );
    },
  );

  it('does not let unchanged nested content hide a parent replacement', async () => {
    const child =
      '\n  - Shared nested details stay exactly the same and must not hide changed parent text.';
    const rendered = await renderDiff('- Apples' + child, '- Oranges' + child);
    const items = rendered.querySelectorAll(':scope > ul > li');

    expect(items).toHaveLength(2);
    expect(items[0].className).toBe('git-removed');
    expect(items[1].className).toBe('git-added');
    expect(items[0].firstChild?.textContent).toContain('Apples');
    expect(items[1].firstChild?.textContent).toContain('Oranges');
    expect(items[0].querySelector('ul')).not.toBeNull();
    expect(items[1].querySelector('ul')).not.toBeNull();
  });

  it('keeps nested replacements inside their unchanged parent', async () => {
    const rendered = await renderDiff(
      '- Fruit\n  - Apples\n  - Bananas',
      '- Fruit\n  - Oranges\n  - Bananas',
    );
    const parents = rendered.querySelectorAll(':scope > ul > li');

    expect(parents).toHaveLength(1);
    expect(parents[0].className).toBe('');
    expect(
      [...parents[0].querySelectorAll('li')].map((item) => [
        item.textContent?.trim(),
        item.className,
      ]),
    ).toEqual([
      ['Apples', 'git-removed'],
      ['Oranges', 'git-added'],
      ['Bananas', ''],
    ]);
  });
});
