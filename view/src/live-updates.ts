import type { ViewProjectChange } from '../../src/view/protocol';

/** Hidden tabs must not exhaust the browser's HTTP/1 connection pool with SSE. */
export function subscribeVisibleViewEvents(
  onReady: (event: MessageEvent<string>) => void,
  onChange: (event: MessageEvent<string>) => void,
): () => void {
  let events: EventSource | null = null;
  let suspended = false;
  const disconnect = () => {
    events?.close();
    events = null;
  };
  const synchronize = () => {
    if (suspended || document.visibilityState === 'hidden') {
      disconnect();
    } else if (!events) {
      events = new EventSource('/api/events');
      events.addEventListener('ready', onReady);
      events.addEventListener('change', onChange);
    }
  };
  const hide = () => {
    suspended = true;
    disconnect();
  };
  const show = () => {
    suspended = false;
    synchronize();
  };
  document.addEventListener('visibilitychange', synchronize);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  synchronize();
  return () => {
    document.removeEventListener('visibilitychange', synchronize);
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
    disconnect();
  };
}

/** Keep generations monotonic within one server, but trust a new server instance. */
export function mergeProjectChange(
  current: ViewProjectChange,
  incoming: ViewProjectChange,
): ViewProjectChange {
  if (current.instanceId !== incoming.instanceId) return incoming;
  const generation = Math.max(current.generation, incoming.generation);
  const markdownGeneration = Math.max(
    current.markdownGeneration,
    incoming.markdownGeneration,
  );
  return generation === current.generation &&
    markdownGeneration === current.markdownGeneration
    ? current
    : { ...current, generation, markdownGeneration };
}
