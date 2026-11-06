export const VIEW_STATIC_BOOTSTRAP_ID = 'lat-static-bootstrap';
/** Match the live document endpoint key used by the static browser adapter. */
export function viewStaticDocumentRequest(path) {
    return `/api/document?path=${encodeURIComponent(path)}`;
}
/** Stable lookup key shared by the static exporter and browser adapter. */
export function viewStaticSourceKey(request) {
    return JSON.stringify([
        request.path,
        request.symbol,
        request.from,
        request.line,
        request.at,
    ]);
}
