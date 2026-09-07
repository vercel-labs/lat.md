// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mergeProjectChange,
  subscribeVisibleViewEvents,
} from '../view/src/live-updates.js';

describe('live view updates', () => {
  // @lat: [[lat.md/view/specs#View Tests#Updates long-running views incrementally#Accepts restarted server generations]]
  it('accepts lower generations from a new server instance', () => {
    const current = {
      instanceId: 'old-server',
      generation: 42,
      markdownGeneration: 17,
    };

    expect(
      mergeProjectChange(current, {
        instanceId: 'old-server',
        generation: 40,
        markdownGeneration: 15,
      }),
    ).toBe(current);
    expect(
      mergeProjectChange(current, {
        instanceId: 'new-server',
        generation: 0,
        markdownGeneration: 0,
      }),
    ).toEqual({
      instanceId: 'new-server',
      generation: 0,
      markdownGeneration: 0,
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// @lat: [[lat.md/view/specs#View Tests#Updates long-running views incrementally#Releases background event streams]]
it('releases hidden streams and reconnects once with ready/change handlers', () => {
  let visibility: DocumentVisibilityState = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
  const streams: FakeEvents[] = [];
  class FakeEvents extends EventTarget {
    close = vi.fn();
    constructor() {
      super();
      streams.push(this);
    }
  }
  vi.stubGlobal('EventSource', FakeEvents);
  const ready = vi.fn();
  const change = vi.fn();
  const stop = subscribeVisibleViewEvents(ready, change);
  try {
    expect(streams).toHaveLength(1);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(streams[0].close).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(streams).toHaveLength(1);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    expect(streams).toHaveLength(2);
    streams[1].dispatchEvent(
      new MessageEvent('ready', { data: 'latest generation' }),
    );
    streams[1].dispatchEvent(new MessageEvent('change'));
    expect(ready).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(streams[1].close).toHaveBeenCalledOnce();
    expect(streams).toHaveLength(2);
    window.dispatchEvent(new Event('pageshow'));
    expect(streams).toHaveLength(3);
  } finally {
    stop();
  }
  window.dispatchEvent(new Event('pageshow'));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(streams).toHaveLength(3);
  expect(streams[2].close).toHaveBeenCalledOnce();
});

it('does not open an event stream when mounted in a hidden tab', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const create = vi.fn();
  vi.stubGlobal('EventSource', create);
  const stop = subscribeVisibleViewEvents(vi.fn(), vi.fn());
  expect(create).not.toHaveBeenCalled();
  stop();
});
