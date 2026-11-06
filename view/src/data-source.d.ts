import type { ViewDocumentEditRequest, ViewDocumentEditResponse, ViewDocumentSource } from '../../src/view/protocol';
export declare const VIEW_REQUEST_TIMEOUT_MS = 15000;
export declare class ViewRequestTimeoutError extends Error {
    name: string;
}
export declare class ViewRequestConnectionError extends Error {
    name: string;
}
export declare function fetchViewDocumentSource(path: string, signal?: AbortSignal): Promise<ViewDocumentSource>;
export declare function updateViewDocument(path: string, edit: ViewDocumentEditRequest, signal?: AbortSignal): Promise<ViewDocumentEditResponse>;
/** Warm a content-addressed document when a static navigation is imminent. */
export declare function prefetchViewDocument(path: string): Promise<void>;
/** Resolve either a live API request or its immutable static-build equivalent. */
export declare function fetchViewJson<T extends object>(requestUrl: string, signal?: AbortSignal): Promise<T>;
