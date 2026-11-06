import type { SourceSpan } from '../../src/search/types';
export declare function searchResultUrl(url: string, spans: readonly SourceSpan[]): string;
export declare function searchMatchRanges(search: string): [number, number][];
/** Highlight the smallest rendered blocks overlapping the matched source lines. */
export declare function applySearchHighlights(container: HTMLElement | null, search: string): HTMLElement[];
