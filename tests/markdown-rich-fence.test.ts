// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MarkdownRichFence,
  parseMermaidSvg,
} from '../view/src/MarkdownRichFence.js';
import { getMermaid } from '../view/src/markdown-rich-fences.js';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

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
      expect(dialog.querySelector('.markdown-mermaid-toolbar')).toBeNull();
      expect(
        dialog.querySelector('.markdown-mermaid-zoom-controls')?.textContent,
      ).toContain('View raw');
      expect(
        dialog.querySelector('.markdown-mermaid-zoom-controls')?.textContent,
      ).toContain('Close full screen');
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
      expect(
        dialog.querySelector('.markdown-mermaid-zoom-controls')?.textContent,
      ).toContain('View chart');
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

  // @lat: [[view/specs#Mermaid fullscreen navigation]]
  it('zooms, navigates the overview, and resets without rerendering Mermaid', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const mermaid = await getMermaid();
    const render = vi.spyOn(mermaid, 'render').mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" id="zoom-test" viewBox="0 0 100 100"><style>#zoom-test {color:red}</style><defs><marker id="arrow" /></defs><path marker-end="url(#arrow)"/><text>Diagram</text></svg>',
      diagramType: 'flowchart-v2',
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          createElement(MarkdownRichFence, {
            kind: 'mermaid',
            source: 'flowchart LR\n A --> B',
            fallback: 'Loading',
          }),
        ),
      );
      const dialog = container.querySelector('dialog')!;
      dialog.showModal = () => {
        dialog.open = true;
      };
      dialog.close = () => {
        dialog.open = false;
      };
      const button = (label: string) =>
        [...container.querySelectorAll('button')].find(
          (b) =>
            b.getAttribute('aria-label') === label || b.textContent === label,
        )!;
      await act(async () => button('View Mermaid diagram full screen').click());
      const viewport = dialog.querySelector<HTMLElement>('[role="region"]')!;
      Object.defineProperties(viewport, {
        clientWidth: { value: 800 },
        clientHeight: { value: 600 },
      });
      expect(button('Zoom out').disabled).toBe(false);
      await act(async () => button('Zoom out').click());
      await act(async () => button('Zoom out').click());
      await act(async () => button('Zoom out').click());
      expect(dialog.textContent).toContain('30%');
      expect(button('Zoom out').disabled).toBe(true);
      expect(
        viewport.querySelector<HTMLElement>('.markdown-mermaid-zoom-stage')!
          .style.left,
      ).toBe('35%');
      expect(
        viewport.querySelector<HTMLElement>('.markdown-mermaid-zoom-stage')!
          .style.top,
      ).toBe('35%');
      expect(dialog.querySelector('.markdown-mermaid-minimap')).toBeNull();
      await act(async () => button('Fit to screen').click());
      await act(async () => button('Zoom in').click());
      expect(dialog.textContent).toContain('125%');
      expect(viewport.scrollLeft).toBe(100);
      expect(viewport.scrollTop).toBe(75);
      const overview = dialog.querySelector<HTMLButtonElement>(
        '.markdown-mermaid-minimap',
      )!;
      expect(overview.querySelector('style')!.textContent).toContain(
        '#zoom-test-overview',
      );
      expect(overview.querySelector('path')!.getAttribute('marker-end')).toBe(
        'url(#arrow-overview)',
      );
      const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      await act(async () => overview.click());
      expect(viewport.scrollLeft).toBe(100);
      expect(viewport.scrollTop).toBe(75);
      viewport.setPointerCapture = vi.fn();
      viewport.hasPointerCapture = () => true;
      viewport.releasePointerCapture = vi.fn();
      await act(async () => {
        viewport.dispatchEvent(
          new MouseEvent('pointerdown', {
            button: 0,
            clientX: 100,
            clientY: 100,
            bubbles: true,
          }),
        );
        viewport.dispatchEvent(
          new MouseEvent('pointermove', {
            clientX: 75,
            clientY: 80,
            bubbles: true,
          }),
        );
        viewport.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      });
      expect(viewport.scrollLeft).toBe(125);
      expect(viewport.scrollTop).toBe(95);
      overview.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 160, height: 120 }) as DOMRect;
      await act(async () =>
        overview.dispatchEvent(
          new MouseEvent('click', {
            clientX: 80,
            clientY: 60,
            detail: 1,
            bubbles: true,
          }),
        ),
      );
      expect(viewport.scrollLeft).toBe(100);
      expect(viewport.scrollTop).toBe(75);
      overview.setPointerCapture = vi.fn();
      overview.hasPointerCapture = () => true;
      overview.releasePointerCapture = vi.fn();
      const overviewBox = overview.querySelector(
        '.markdown-mermaid-minimap-frame',
      )!;
      const moveOverview = (
        target: Element,
        type: string,
        x: number,
        y: number,
      ) => {
        const event = new MouseEvent(type, {
          button: 0,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        });
        Object.assign(event, { pointerId: 7, pointerType: 'touch' });
        target.dispatchEvent(event);
      };
      await act(async () => moveOverview(overviewBox, 'pointerdown', 40, 30));
      expect(viewport.scrollLeft).toBe(100);
      await act(async () => moveOverview(overview, 'pointermove', 48, 34));
      expect(viewport.scrollLeft).toBe(150);
      expect(viewport.scrollTop).toBe(100);
      await act(async () => moveOverview(overview, 'pointermove', 1000, 1000));
      expect(viewport.scrollLeft).toBe(200);
      expect(viewport.scrollTop).toBe(150);
      await act(async () =>
        moveOverview(overview, 'pointermove', -1000, -1000),
      );
      expect(viewport.scrollLeft).toBe(0);
      expect(viewport.scrollTop).toBe(0);
      await act(async () => moveOverview(overview, 'pointerup', 48, 34));
      await act(async () =>
        overview.dispatchEvent(
          new MouseEvent('click', {
            clientX: 48,
            clientY: 34,
            detail: 1,
            bubbles: true,
          }),
        ),
      );
      expect(viewport.scrollLeft).toBe(0);
      expect(viewport.scrollTop).toBe(0);
      await act(async () => moveOverview(overviewBox, 'pointerdown', 20, 20));
      await act(async () => moveOverview(overview, 'pointercancel', 20, 20));
      await act(async () => moveOverview(overview, 'pointermove', 80, 60));
      expect(viewport.scrollLeft).toBe(0);
      await act(async () => overview.click());
      expect(viewport.scrollLeft).toBe(100);
      await act(async () =>
        viewport.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
        ),
      );
      expect(dialog.textContent).toContain('100%');
      expect(viewport.scrollLeft).toBe(0);
      expect(dialog.querySelector('.markdown-mermaid-minimap')).toBeNull();
      await act(async () =>
        viewport.dispatchEvent(
          new KeyboardEvent('keydown', { key: '+', bubbles: true }),
        ),
      );
      expect(dialog.textContent).toContain('125%');
      for (let i = 0; i < 40; i++)
        await act(async () => button('Zoom in').click());
      expect(button('Zoom in').disabled).toBe(true);
      expect(dialog.textContent).toContain('1000%');
      viewport.scrollLeft = 250;
      viewport.scrollTop = 175;
      await act(async () =>
        [...dialog.querySelectorAll('button')]
          .find((b) => b.textContent === 'View raw')!
          .click(),
      );
      expect(dialog.querySelector('[aria-label="Diagram zoom"]')).toBeNull();
      await act(async () =>
        [...dialog.querySelectorAll('button')]
          .find((b) => b.textContent === 'View chart')!
          .click(),
      );
      expect(dialog.textContent).toContain('1000%');
      const gestureViewport =
        dialog.querySelector<HTMLElement>('[role="region"]')!;
      expect(gestureViewport.scrollLeft).toBe(250);
      expect(gestureViewport.scrollTop).toBe(175);
      await act(async () => button('Fit to screen').click());
      Object.defineProperties(gestureViewport, {
        clientWidth: { value: 800 },
        clientHeight: { value: 600 },
      });
      const wheel = new WheelEvent('wheel', {
        deltaY: -Math.log(2) / 0.01,
        ctrlKey: true,
        clientX: 100,
        clientY: 80,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => gestureViewport.dispatchEvent(wheel));
      expect(wheel.defaultPrevented).toBe(true);
      expect(dialog.textContent).toContain('200%');
      expect(gestureViewport.scrollLeft).toBeCloseTo(100);
      expect(gestureViewport.scrollTop).toBeCloseTo(80);
      const scroll = new WheelEvent('wheel', {
        deltaY: 20,
        bubbles: true,
        cancelable: true,
      });
      gestureViewport.dispatchEvent(scroll);
      expect(scroll.defaultPrevented).toBe(false);
      await act(async () =>
        gestureViewport.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -10000,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(dialog.textContent).toContain('1000%');
      await act(async () => button('Fit to screen').click());
      const gestureEvent = (type: string, scale: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, { scale, clientX: 200, clientY: 150 });
        return event;
      };
      await act(async () =>
        gestureViewport.dispatchEvent(gestureEvent('gesturestart', 1)),
      );
      await act(async () =>
        gestureViewport.dispatchEvent(gestureEvent('gesturechange', 3)),
      );
      expect(dialog.textContent).toContain('300%');
      await act(async () =>
        gestureViewport.dispatchEvent(gestureEvent('gestureend', 3)),
      );
      await act(async () => button('Fit to screen').click());
      gestureViewport.setPointerCapture = vi.fn();
      gestureViewport.hasPointerCapture = () => true;
      gestureViewport.releasePointerCapture = vi.fn();
      const touch = (type: string, id: number, x: number) => {
        const event = new MouseEvent(type, {
          button: 0,
          clientX: x,
          clientY: 100,
          bubbles: true,
          cancelable: true,
        });
        Object.assign(event, { pointerId: id, pointerType: 'touch' });
        gestureViewport.dispatchEvent(event);
      };
      await act(async () => {
        touch('pointerdown', 1, 100);
        touch('pointerdown', 2, 200);
      });
      await act(async () => touch('pointermove', 2, 300));
      expect(dialog.textContent).toContain('200%');
      await act(async () => {
        touch('pointercancel', 2, 300);
        touch('pointerup', 1, 100);
      });
      await act(async () => button('Fit to screen').click());
      expect(gestureViewport.scrollLeft).toBe(0);
      await act(async () =>
        gestureViewport.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: 10000,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(dialog.textContent).toContain('30%');
      expect(button('Zoom out').disabled).toBe(true);
      await act(async () => button('Fit to screen').click());
      expect(dialog.textContent).toContain('100%');
      await act(async () => button('Zoom in').click());
      gestureViewport.scrollLeft = 90;
      gestureViewport.scrollTop = 60;
      await act(async () => button('Close full screen').click());
      const storageKey = Object.keys(localStorage).find((key) =>
        key.startsWith('lat:mermaid-view:'),
      )!;
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({
        zoom: 1.25,
        left: 90,
        top: 60,
      });
      // Force restoration from storage rather than relying on component memory.
      localStorage.setItem(
        storageKey,
        JSON.stringify({ zoom: 2, left: 120, top: 80 }),
      );
      await act(async () => button('View Mermaid diagram full screen').click());
      expect(dialog.textContent).toContain('200%');
      expect(
        dialog.querySelector<HTMLElement>('[role="region"]')!.scrollLeft,
      ).toBe(120);
      await act(async () => button('Close full screen').click());
      localStorage.setItem(storageKey, '{invalid');
      await act(async () => button('View Mermaid diagram full screen').click());
      expect(dialog.textContent).toContain('100%');
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
