import type { ViewGraph, ViewGraphNode } from '../../src/view/protocol';
type DocumentScroller = {
    getElementById: (id: string) => {
        scrollIntoView: (options: ScrollIntoViewOptions) => void;
    } | null;
    scrollTo: (options: ScrollToOptions) => void;
};
export declare function documentUrl(path: string): string;
export declare function documentPath(pathname: string): string | null;
/** Build the raw Markdown URL paired with a local rendered document route. */
export declare function rawDocumentUrl(path: string): string;
/** Build the browser route for one canonical external target. */
export declare function externalUrl(target: string): string;
/** Keep rendered-document route identity stable when only its fragment changes. */
export declare function viewRouteIdentity(location: string): string;
/** Whether navigation stays within one rendered document. */
export declare function isSameRenderedDocument(current: URL, next: URL): boolean;
export type ViewExternalTarget = {
    handle: string;
    path: string;
    fragment: string;
    identity: string;
};
export declare function externalTarget(pathname: string, hash?: string): ViewExternalTarget | null;
export declare function sourcePath(pathname: string): string | null;
export declare function sourceSymbol(hash: string): string;
export declare function searchQuery(search: string): string;
export declare function searchUrl(query: string): string;
export declare function graphNode(search: string): string;
export declare function graphTarget(search: string): string;
export declare function graphUrl(nodeId?: string, target?: string): string;
type GraphModeStorage = {
    getItem: (key: string) => string | null;
    removeItem: (key: string) => void;
    setItem: (key: string, value: string) => void;
};
export declare function graphModeStorageKey(basePath: string | null): string;
export declare function readGraphMode(storage: GraphModeStorage, key: string): boolean;
export declare function writeGraphMode(storage: GraphModeStorage, key: string, enabled: boolean): void;
export type GraphSelection = {
    nodeId: string;
    target: string;
};
/** Map a normal document or source URL to its stable graph node id. */
export declare function graphNodeIdForUrl(url: URL, externalKind?: 'document' | 'source'): string;
/** Resolve an inspector destination to its stable graph node and exact route. */
export declare function graphSelectionForUrl(graph: ViewGraph, url: URL): GraphSelection | null;
/** Resolve a raw inspector href against the previewed document or source. */
export declare function graphInspectorLinkUrl(href: string, previewRoute: string, origin: string): URL | null;
/** Accept a copied target only when it still belongs to the selected node. */
export declare function graphTargetForNode(graph: ViewGraph, node: ViewGraphNode, target: string, origin: string): string;
export type ViewScrollPosition = {
    left: number;
    top: number;
};
export declare function searchHistoryState(returnTo: string): Record<string, string>;
export declare function searchReturnTo(state: unknown): string | null;
export declare function historyStateWithScroll(state: unknown, position: ViewScrollPosition): Record<string, unknown>;
export declare function historyScrollPosition(state: unknown): ViewScrollPosition | null;
export declare function searchEscapeAction(query: string): 'clear' | 'close';
export declare function searchButtonAction(pathname: string): 'close' | 'open';
/** Position a newly rendered document without leaving its content in motion. */
export declare function scrollToDocumentLocation(hash: string, scroller: DocumentScroller, topHeadingId?: string): void;
export {};
