import type { ViewDocumentElement, ViewDocumentTree } from './protocol.js';
type HastLikeNode = {
    type?: unknown;
    value?: unknown;
    tagName?: unknown;
    properties?: unknown;
    children?: unknown;
};
/** Strip a sanitized HAST tree to the stable JSON wire representation. */
export declare function toViewDocumentTree(tree: HastLikeNode): ViewDocumentTree;
export declare function documentTreeUrls(tree: ViewDocumentTree): string[];
export declare function visitDocumentElements(tree: ViewDocumentTree, visitor: (element: ViewDocumentElement) => void): void;
/** Apply parser-neutral presentation to links that leave the current site. */
export declare function decorateExternalSiteLinks(tree: ViewDocumentTree): ViewDocumentTree;
/** Clone a document tree while structurally rewriting navigable URLs. */
export declare function rewriteDocumentTreeUrls(tree: ViewDocumentTree, rewrite: (value: string) => string): ViewDocumentTree;
export declare function textDocumentTree(value: string): ViewDocumentTree;
export {};
