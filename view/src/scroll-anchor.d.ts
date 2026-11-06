export type ScrollAnchor = {
    elementId: string;
    top: number;
};
type AnchorElement = {
    getBoundingClientRect: () => {
        top: number;
    };
};
export type ScrollAnchorViewport = {
    getElementById: (id: string) => AnchorElement | null;
    scrollBy: (options: ScrollToOptions) => void;
};
/** Capture a rendered element's viewport position before prepending content. */
export declare function captureScrollAnchor(elementId: string, viewport: Pick<ScrollAnchorViewport, 'getElementById'>): ScrollAnchor | null;
/** Offset the window by an anchor's displacement after layout changes. */
export declare function restoreScrollAnchor(anchor: ScrollAnchor, viewport: ScrollAnchorViewport): void;
export {};
