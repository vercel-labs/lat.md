/** Keep the current section's entire subtree emphasized while its children scroll. */
export declare function documentTocActiveGroup(items: readonly {
    id: string;
    depth: number;
}[], activeId: string): {
    groupIds: Set<string>;
    ancestorIds: Set<string>;
};
export declare function activeDocumentTocId(ids: readonly string[], tops: ReadonlyMap<string, number>, threshold?: number): string;
export declare function documentTocIndentationDepth(depth: number, minimumSubsectionDepth: number): number;
export declare function documentTocActivationLine({ scrollTop, viewportHeight, scrollHeight, topOffset, }: {
    scrollTop: number;
    viewportHeight: number;
    scrollHeight: number;
    topOffset?: number;
}): number;
/** Frame-rate-independent easing that can follow a changing destination. */
export declare function nextDocumentTocScrollTop(current: number, target: number, elapsedMs: number): number;
export declare function centeredDocumentTocScrollTop({ containerHeight, contentHeight, itemHeight, itemTop, }: {
    containerHeight: number;
    contentHeight: number;
    itemHeight: number;
    itemTop: number;
}): number;
