import { isDocumentPath } from '@lat.md/core/document-formats';
import { staticViewRoute, viewPathname, viewEntryPath } from './static-mode';
import { documentPath as routeDocumentPath, documentUrl as routeDocumentUrl, } from '../../src/view/document-route';
const SOURCE_PREFIX = '/code/';
const EXTERNAL_PREFIX = '/external/';
export function documentUrl(path) {
    const route = routeDocumentUrl(path);
    return (staticViewRoute(route.slice(1)) ?? (path === viewEntryPath() ? '/' : route));
}
export function documentPath(pathname) {
    return routeDocumentPath(viewPathname(pathname));
}
/** Build the raw Markdown URL paired with a local rendered document route. */
export function rawDocumentUrl(path) {
    const route = `${routeDocumentUrl(path)}.md`;
    return staticViewRoute(route.slice(1)) ?? route;
}
/** Build the browser route for one canonical external target. */
export function externalUrl(target) {
    const colon = target.indexOf(':');
    const hash = target.indexOf('#', colon + 1);
    const handle = target.slice(0, colon);
    const path = hash === -1 ? target.slice(colon + 1) : target.slice(colon + 1, hash);
    const fragment = hash === -1 ? '' : target.slice(hash + 1);
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const route = `external/${encodeURIComponent(handle)}/${encodedPath}/`;
    const url = staticViewRoute(route) ??
        `${EXTERNAL_PREFIX}${encodeURIComponent(handle)}/${encodedPath}`;
    return `${url}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`;
}
/** Keep rendered-document route identity stable when only its fragment changes. */
export function viewRouteIdentity(location) {
    const url = new URL(location, 'http://lat.local');
    const external = externalTarget(url.pathname, url.hash);
    return documentPath(url.pathname) ||
        (external && isDocumentPath(external.path))
        ? `${url.pathname}${url.search}`
        : `${url.pathname}${url.search}${url.hash}`;
}
/** Whether navigation stays within one rendered document. */
export function isSameRenderedDocument(current, next) {
    const currentExternal = externalTarget(current.pathname, current.hash);
    const nextExternal = externalTarget(next.pathname, next.hash);
    return ((documentPath(current.pathname) !== null ||
        (currentExternal !== null && nextExternal !== null)) &&
        current.origin === next.origin &&
        current.pathname === next.pathname &&
        current.search === next.search);
}
export function externalTarget(pathname, hash = '') {
    pathname = viewPathname(pathname);
    if (!pathname.startsWith(EXTERNAL_PREFIX))
        return null;
    try {
        const parts = pathname
            .slice(EXTERNAL_PREFIX.length)
            .split('/')
            .map(decodeURIComponent);
        const handle = parts.shift() ?? '';
        const path = parts.join('/');
        if (!handle || !path)
            return null;
        const fragment = sourceSymbol(hash);
        return {
            handle,
            path,
            fragment,
            identity: `${handle}:${path}${fragment ? `#${fragment}` : ''}`,
        };
    }
    catch {
        return null;
    }
}
export function sourcePath(pathname) {
    pathname = viewPathname(pathname);
    if (!pathname.startsWith(SOURCE_PREFIX))
        return null;
    try {
        return pathname
            .slice(SOURCE_PREFIX.length)
            .split('/')
            .map(decodeURIComponent)
            .join('/');
    }
    catch {
        return null;
    }
}
export function sourceSymbol(hash) {
    if (!hash)
        return '';
    try {
        return decodeURIComponent(hash.slice(1));
    }
    catch {
        return hash.slice(1);
    }
}
export function searchQuery(search) {
    return new URLSearchParams(search).get('q') ?? '';
}
export function searchUrl(query) {
    const path = staticViewRoute('search/') ?? '/search';
    if (!query)
        return path;
    const search = new URLSearchParams({ q: query });
    return `${path}?${search}`;
}
export function graphNode(search) {
    return new URLSearchParams(search).get('node') ?? '';
}
export function graphTarget(search) {
    return new URLSearchParams(search).get('target') ?? '';
}
export function graphUrl(nodeId = '', target = '') {
    const path = staticViewRoute('graph/') ?? '/graph';
    if (!nodeId && !target)
        return path;
    const search = new URLSearchParams();
    if (nodeId)
        search.set('node', nodeId);
    if (target)
        search.set('target', target);
    return `${path}?${search}`;
}
export function graphModeStorageKey(basePath) {
    return `lat.ui.graph-mode:${basePath ?? '/'}`;
}
export function readGraphMode(storage, key) {
    return storage.getItem(key) === 'true';
}
export function writeGraphMode(storage, key, enabled) {
    if (enabled)
        storage.setItem(key, 'true');
    else
        storage.removeItem(key);
}
function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
/** Map a normal document or source URL to its stable graph node id. */
export function graphNodeIdForUrl(url, externalKind) {
    const markdown = documentPath(url.pathname);
    if (markdown !== null)
        return `document:${markdown}`;
    const external = externalTarget(url.pathname, url.hash);
    if (external) {
        return externalKind === 'document' ||
            (externalKind === undefined && isDocumentPath(external.path))
            ? `external-document:${external.handle}:${external.path}`
            : `external-source:${external.identity}`;
    }
    const source = sourcePath(url.pathname);
    if (source === null)
        return '';
    const focusLine = positiveInteger(url.searchParams.get('at'));
    if (focusLine > 0)
        return `code-ref:${source}:${focusLine}`;
    const symbol = sourceSymbol(url.hash);
    return `source:${source}${symbol ? `#${symbol}` : ''}`;
}
function internalRoute(url) {
    return `${url.pathname}${url.search}${url.hash}`;
}
/** Resolve an inspector destination to its stable graph node and exact route. */
export function graphSelectionForUrl(graph, url) {
    const markdown = documentPath(url.pathname);
    if (markdown !== null) {
        const node = graph.nodes.find((candidate) => candidate.kind === 'document' && candidate.documentPath === markdown);
        return node ? { nodeId: node.id, target: internalRoute(url) } : null;
    }
    const external = externalTarget(url.pathname, url.hash);
    if (external) {
        const ids = [
            `external-document:${external.handle}:${external.path}`,
            `external-source:${external.identity}`,
        ];
        const node = graph.nodes.find((candidate) => ids.includes(candidate.id));
        return node ? { nodeId: node.id, target: internalRoute(url) } : null;
    }
    const source = sourcePath(url.pathname);
    if (source === null)
        return null;
    const focusLine = positiveInteger(url.searchParams.get('at'));
    const symbol = sourceSymbol(url.hash);
    let node;
    if (focusLine > 0) {
        node = graph.nodes.find((candidate) => candidate.kind === 'code-reference' &&
            candidate.sourcePath === source &&
            candidate.line === focusLine);
    }
    if (!node && symbol) {
        node = graph.nodes.find((candidate) => candidate.kind === 'source' &&
            candidate.sourcePath === source &&
            candidate.symbol === symbol);
    }
    if (!node && !symbol && focusLine === 0) {
        node = graph.nodes.find((candidate) => candidate.kind === 'source' &&
            candidate.sourcePath === source &&
            !candidate.symbol);
    }
    return node ? { nodeId: node.id, target: internalRoute(url) } : null;
}
/** Resolve a raw inspector href against the previewed document or source. */
export function graphInspectorLinkUrl(href, previewRoute, origin) {
    try {
        const application = new URL(origin);
        const url = new URL(href, new URL(previewRoute, application));
        return url.origin === application.origin ? url : null;
    }
    catch {
        return null;
    }
}
/** Accept a copied target only when it still belongs to the selected node. */
export function graphTargetForNode(graph, node, target, origin) {
    if (!target)
        return node.url;
    const url = graphInspectorLinkUrl(target, node.url, origin);
    const selection = url ? graphSelectionForUrl(graph, url) : null;
    return selection?.nodeId === node.id ? selection.target : node.url;
}
const SEARCH_RETURN_KEY = 'latSearchReturnTo';
const SCROLL_POSITION_KEY = 'latScrollPosition';
export function searchHistoryState(returnTo) {
    return { [SEARCH_RETURN_KEY]: returnTo };
}
export function searchReturnTo(state) {
    if (!state || typeof state !== 'object')
        return null;
    const returnTo = state[SEARCH_RETURN_KEY];
    return typeof returnTo === 'string' && returnTo.startsWith('/')
        ? returnTo
        : null;
}
export function historyStateWithScroll(state, position) {
    const current = state && typeof state === 'object' && !Array.isArray(state)
        ? state
        : {};
    return { ...current, [SCROLL_POSITION_KEY]: position };
}
export function historyScrollPosition(state) {
    if (!state || typeof state !== 'object')
        return null;
    const position = state[SCROLL_POSITION_KEY];
    if (!position || typeof position !== 'object')
        return null;
    const { left, top } = position;
    return typeof left === 'number' &&
        Number.isFinite(left) &&
        typeof top === 'number' &&
        Number.isFinite(top)
        ? { left, top }
        : null;
}
export function searchEscapeAction(query) {
    return query ? 'clear' : 'close';
}
export function searchButtonAction(pathname) {
    return viewPathname(pathname) === '/search' ? 'close' : 'open';
}
/** Position a newly rendered document without leaving its content in motion. */
export function scrollToDocumentLocation(hash, scroller, topHeadingId = '') {
    if (!hash) {
        scroller.scrollTo({ top: 0, behavior: 'instant' });
        return;
    }
    let id = hash.slice(1);
    try {
        id = decodeURIComponent(id);
    }
    catch {
        // Leave malformed fragments untouched; they simply will not match.
    }
    if (id === topHeadingId) {
        scroller.scrollTo({ top: 0, behavior: 'instant' });
        return;
    }
    scroller
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'instant', block: 'start' });
}
