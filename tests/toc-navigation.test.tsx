// @vitest-environment jsdom
/// <reference types="vite/client" />
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../src/view/markdown';
import type { ViewDocument, ViewIndex } from '../src/view/protocol';

const { fetchViewJson } = vi.hoisted(() => ({ fetchViewJson: vi.fn() }));
vi.mock('../view/src/data-source', () => ({
  fetchViewJson,
  prefetchViewDocument: vi.fn(),
}));
vi.mock('../view/src/live-updates', () => ({
  subscribeVisibleViewEvents: () => () => {},
  mergeProjectChange: vi.fn(),
}));
import { App } from '../view/src/App';
import { historyStateWithScroll } from '../view/src/navigation';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('document TOC navigation', () => {
  let root: Root;
  let container: HTMLDivElement;
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal('scrollTo', scrollTo);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.localStorage.clear();
    window.history.replaceState(null, '', '/guide?match=7-7#detail');
    const { tree } = await renderMarkdown(
      '# Guide\n\nIntroduction.\n\n## Detail\n\nMatched passage.\n\n## Other\n\nAnother section.\n',
      'guide.md',
    );
    const doc: ViewDocument = {
      path: 'guide.md',
      title: 'Guide',
      tree,
      gitTree: null,
      graphNodeIds: {},
      errors: [],
      backReferences: [],
      frontmatter: { requireCodeMention: false },
      tableOfContents: [
        {
          id: 'guide',
          title: 'Guide',
          depth: 1,
          errorCount: 0,
          hasGitChanges: false,
        },
        {
          id: 'detail',
          title: 'Detail',
          depth: 2,
          errorCount: 0,
          hasGitChanges: false,
        },
        {
          id: 'other',
          title: 'Other',
          depth: 2,
          errorCount: 0,
          hasGitChanges: false,
        },
      ],
    };
    const index: ViewIndex = {
      files: ['guide.md'],
      directoryOrder: {},
      externalFiles: [],
      entry: 'guide.md',
      errorCounts: {},
      git: null,
      logoText: 'lat.md',
    };
    fetchViewJson
      .mockReset()
      .mockImplementation(async (url: string) =>
        url === '/api/index' ? index : doc,
      );
    scrollIntoView.mockClear();
    scrollTo.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(App)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    vi.unstubAllGlobals();
  });

  // @lat: [[view/specs#View Tests#TOC navigation from search results]]
  it('prioritizes clicked headings over highlights, including repeated clicks, without remounting or refetching', async () => {
    const article = container.querySelector('.markdown');
    const match = container.querySelector('.search-match');
    expect(scrollIntoView.mock.instances.at(-1)).toBe(match);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'instant',
      block: 'center',
    });
    const fetches = fetchViewJson.mock.calls.length;
    const link = container.querySelector<HTMLAnchorElement>(
      '.document-toc-link[href="#other"]',
    )!;
    for (let click = 0; click < 2; click++) {
      scrollIntoView.mockClear();
      await act(async () => link.click());
      expect(window.location.hash).toBe('#other');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(
        container.querySelector('#other'),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'start',
      });
      expect(container.querySelector('.markdown')).toBe(article);
      expect(container.querySelector('.search-match')).toBe(match);
      expect(fetchViewJson).toHaveBeenCalledTimes(fetches);
    }
    scrollIntoView.mockClear();
    scrollTo.mockClear();
    await act(async () =>
      container
        .querySelector<HTMLAnchorElement>('.document-toc-link[href="#guide"]')!
        .click(),
    );
    expect(window.location.hash).toBe('#guide');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledTimes(1);

    scrollTo.mockClear();
    await act(async () => {
      window.history.replaceState(
        historyStateWithScroll(null, { left: 0, top: 321 }),
        '',
        '/guide?match=7-7#other',
      );
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: window.history.state }),
      );
    });
    expect(scrollTo).toHaveBeenCalledWith({
      left: 0,
      top: 321,
      behavior: 'instant',
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector('.markdown')).toBe(article);
    expect(fetchViewJson).toHaveBeenCalledTimes(fetches);
  });
});
