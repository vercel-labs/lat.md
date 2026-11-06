import type { ElementContent } from 'hast';
import type { ViewDocumentTree } from './protocol.js';
export type HighlightedCodeTree = {
    type: 'root';
    children: ElementContent[];
};
/** Highlight a supported fenced-code language into a safe HAST fragment. */
export declare function highlightCode(language: string, content: string): HighlightedCodeTree | null;
/** Highlight source directly into independently renderable document trees. */
export declare function highlightSource(path: string, content: string): ViewDocumentTree[];
