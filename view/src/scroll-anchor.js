/** Capture a rendered element's viewport position before prepending content. */
export function captureScrollAnchor(elementId, viewport) {
    const element = viewport.getElementById(elementId);
    return element
        ? { elementId, top: element.getBoundingClientRect().top }
        : null;
}
/** Offset the window by an anchor's displacement after layout changes. */
export function restoreScrollAnchor(anchor, viewport) {
    const element = viewport.getElementById(anchor.elementId);
    if (!element)
        return;
    const adjustment = element.getBoundingClientRect().top - anchor.top;
    if (adjustment === 0)
        return;
    viewport.scrollBy({ top: adjustment, behavior: 'instant' });
}
