import type { ViewProjectChange } from '../../src/view/protocol';
/** Hidden tabs must not exhaust the browser's HTTP/1 connection pool with SSE. */
export declare function subscribeVisibleViewEvents(onReady: (event: MessageEvent<string>) => void, onChange: (event: MessageEvent<string>) => void): () => void;
/** Keep generations monotonic within one server, but trust a new server instance. */
export declare function mergeProjectChange(current: ViewProjectChange, incoming: ViewProjectChange): ViewProjectChange;
