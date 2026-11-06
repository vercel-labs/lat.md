import type { ViewDocumentTree } from './protocol.js';
/** Reflect a native non-Markdown parser AST into the browser document tree. */
export declare function renderExternalDocumentTree(format: 'asciidoc' | 'restructuredtext', content: string): Promise<ViewDocumentTree>;
