// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MarkdownRichFence,
  parseMermaidSvg,
} from '../view/src/MarkdownRichFence.js';
import { getMermaid } from '../view/src/markdown-rich-fences.js';

describe('Markdown rich fences', () => {
  it('switches between source and full-screen diagrams without rendering again or duplicating SVG IDs', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const mermaid = await getMermaid();
    const render = vi.spyOn(mermaid, 'render').mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" id="fullscreen-test" viewBox="0 0 100 100"><text>Diagram</text></svg>',
      diagramType: 'flowchart-v2',
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const source = 'flowchart LR\n A["<b>Start</b>"] --> B';
    try {
      await act(async () => {
        root.render(
          createElement(MarkdownRichFence, {
            kind: 'mermaid',
            source,
            fallback: 'Loading',
          }),
        );
      });
      const dialog = container.querySelector('dialog')!;
      // jsdom does not implement the native dialog lifecycle.
      dialog.showModal = vi.fn(() => {
        dialog.open = true;
      });
      dialog.close = vi.fn(() => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      });
      const open = container.querySelector<HTMLButtonElement>(
        '[aria-label="View Mermaid diagram full screen"]',
      )!;
      await act(async () => open.click());
      expect(dialog.open).toBe(true);
      expect(dialog.querySelector('svg')).not.toBeNull();
      expect(container.querySelectorAll('#fullscreen-test')).toHaveLength(1);
      await act(async () =>
        [...dialog.querySelectorAll('button')]
          .find((button) => button.textContent === 'Close full screen')!
          .click(),
      );
      expect(dialog.open).toBe(false);
      expect(dialog.querySelector('svg')).toBeNull();
      expect(container.querySelectorAll('#fullscreen-test')).toHaveLength(1);
      const raw = [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'View raw',
      )!;
      await act(async () => raw.click());
      expect(container.querySelector('pre code')?.textContent).toBe(source);
      expect(container.querySelector('pre b')).toBeNull();
      expect(container.querySelector('#fullscreen-test')).toBeNull();
      expect(raw.textContent).toBe('View chart');
      await act(async () => open.click());
      expect(dialog.querySelector('pre code')?.textContent).toBe(source);
      await act(async () => {
        [...dialog.querySelectorAll('button')]
          .find((button) => button.textContent === 'View chart')!
          .click();
      });
      expect(container.querySelector('pre')).toBeNull();
      expect(container.querySelectorAll('#fullscreen-test')).toHaveLength(1);
      await act(async () => {
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      });
      expect(dialog.open).toBe(false);
      expect(container.querySelectorAll('#fullscreen-test')).toHaveLength(1);
      expect(render).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      render.mockRestore();
    }
  });

  it('preserves HTML line breaks in Mermaid SVG labels', () => {
    const tree = parseMermaidSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">
          <span>First<br>Second&nbsp;line</span>
        </div></foreignObject>
      </svg>
    `);

    expect(JSON.stringify(tree)).toContain('"tagName":"br"');
    expect(JSON.stringify(tree)).toContain('Second\u00a0line');
  });

  it('rejects output without a single SVG root', () => {
    for (const source of [
      'error',
      '<div>error</div>',
      '<svg></svg><div></div>',
    ]) {
      expect(() => parseMermaidSvg(source)).toThrow(
        'Mermaid did not return an SVG document',
      );
    }
  });

  it('renders flowchart and sequence labels into safe SVG trees', async () => {
    // jsdom has no SVG layout; only geometry is stubbed, not Mermaid rendering.
    const original = Object.getOwnPropertyDescriptor(
      SVGElement.prototype,
      'getBBox',
    );
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
    });
    try {
      const mermaid = await getMermaid();
      const diagrams = [
        'flowchart TB\n query["Search query"] --> results["Ranked sections<br/>with source spans"]',
        'flowchart LR\n cache{"Cached?"} -->|Yes| reuse["Reuse vector<br/>Skip embedding"]',
        'sequenceDiagram\n participant B as Browser import stub\n participant N as Next Server Action\n B->>N: Action POST and encoded arguments\n N-->>B: Result',
      ];
      for (const [index, source] of diagrams.entries()) {
        const { svg } = await mermaid.render(`multiline-test-${index}`, source);
        const tree = parseMermaidSvg(svg);
        expect(tree).toMatchObject({ type: 'element', tagName: 'svg' });
        if (index < 2) expect(JSON.stringify(tree)).toContain('"tagName":"br"');
        else {
          expect(JSON.stringify(tree)).toContain('messageText');
          expect(JSON.stringify(tree)).toContain('messageLine0');
          expect(JSON.stringify(tree)).toContain('messageLine1');
        }
      }
    } finally {
      if (original)
        Object.defineProperty(SVGElement.prototype, 'getBBox', original);
      else Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
    }
  });

  it('reflects Mermaid SVG without executable nodes or properties', () => {
    const tree = parseMermaidSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)">
        <a href="javascript:alert(2)"><text>safe</text></a>
        <script>alert(3)</script>
        <path d="M0 0L1 1" />
      </svg>
    `);

    expect(tree).toMatchObject({
      type: 'element',
      tagName: 'svg',
      properties: { xmlns: 'http://www.w3.org/2000/svg' },
    });
    expect(JSON.stringify(tree)).not.toContain('onclick');
    expect(JSON.stringify(tree)).not.toContain('javascript:');
    expect(JSON.stringify(tree)).not.toContain('script');
    expect(JSON.stringify(tree)).toContain('M0 0L1 1');
  });
});
