import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { DEFAULT_VIEW_LOGO_TEXT } from '../../src/view/protocol';
import { FileTree } from './FileTree';
import { MarkdownContent } from './MarkdownContent';
import { DocumentModeSwitch } from './DocumentModeSwitch';
import { DocumentToc } from './DocumentToc';
import { fetchViewJson, prefetchViewDocument } from './data-source';
import { mergeProjectChange, subscribeVisibleViewEvents } from './live-updates';
import { documentPath, documentUrl, externalTarget, graphModeStorageKey, graphNode, graphNodeIdForUrl, graphTarget, historyScrollPosition, historyStateWithScroll, isSameRenderedDocument, rawDocumentUrl, readGraphMode, searchButtonAction, searchHistoryState, searchReturnTo, searchUrl, scrollToDocumentLocation, sourcePath, sourceSymbol, viewRouteIdentity, writeGraphMode, } from './navigation';
import { navigateAndCopySectionLink } from './section-back-references';
import { SearchPage } from './SearchPage';
import { applySearchHighlights } from './search-highlights';
import { SectionOutputDialog } from './SectionOutputDialog';
import { sourceLineId, SourceView } from './SourceView';
import latLogoUrl from './logo.svg?url';
import { isStaticView, staticViewAssetUrl, staticViewBasePath, staticViewSearchApi, viewPathname, } from './static-mode';
import { blockUnsavedChangesUnload, confirmDiscardUnsavedChanges, } from './unsaved-changes';
const MarkdownEditor = lazy(() => import('./MarkdownEditor'));
const GraphView = lazy(() => import('./GraphView'));
const NO_GIT_FILES = {};
function BrandText({ text }) {
    const suffix = '.md';
    if (!text.endsWith(suffix))
        return text;
    return (_jsxs(_Fragment, { children: [text.slice(0, -suffix.length), _jsx("span", { children: suffix })] }));
}
function AppHeader({ className, graphActive, graphHref, gitEnabled, gitHasChanges, index, onGitToggle, onGraphNavigate, onNavigate, onSearchNavigate, route, searchEnabled, }) {
    const brandText = index?.logoText ?? DEFAULT_VIEW_LOGO_TEXT;
    return (_jsxs("div", { className: className, children: [_jsx("a", { className: "brand", href: index ? documentUrl(index.entry) : '/', onClick: index ? onNavigate : undefined, title: brandText, children: brandText === DEFAULT_VIEW_LOGO_TEXT ? (_jsx("img", { alt: DEFAULT_VIEW_LOGO_TEXT, className: "brand-logo", src: staticViewAssetUrl(latLogoUrl) })) : (_jsx(BrandText, { text: brandText })) }), _jsxs("div", { className: "sidebar-actions", children: [!graphActive && index?.git && (_jsx("button", { "aria-label": `${gitEnabled ? 'Hide' : 'Show'} Git changes${gitHasChanges ? ', changes available' : ''}`, "aria-pressed": gitEnabled, className: "sidebar-git", "data-has-changes": gitHasChanges || undefined, onClick: onGitToggle, title: `${gitEnabled ? 'Hide' : 'Show'} Git changes`, type: "button", children: _jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "7", cy: "5", r: "2" }), _jsx("circle", { cx: "7", cy: "19", r: "2" }), _jsx("circle", { cx: "17", cy: "9", r: "2" }), _jsx("path", { d: "M7 7v10M9 15c5 0 8-1.5 8-4" })] }) })), !graphActive && searchEnabled && (_jsx("a", { "aria-current": route?.kind === 'search' ? 'page' : undefined, "aria-label": "Search", className: "sidebar-search", href: searchUrl(''), onClick: onSearchNavigate, title: "Search", children: _jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "11", cy: "11", r: "6.5" }), _jsx("path", { d: "m16 16 4 4" })] }) })), _jsx("a", { "aria-current": graphActive ? 'page' : undefined, "aria-label": "Graph", className: "sidebar-graph", href: graphHref, onClick: onGraphNavigate, title: "Graph", children: _jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "6", cy: "7", r: "2" }), _jsx("circle", { cx: "18", cy: "6", r: "2" }), _jsx("circle", { cx: "16", cy: "18", r: "2" }), _jsx("circle", { cx: "7", cy: "17", r: "2" }), _jsx("path", { d: "m8 7 8-1M17 8l-1 8M14 18l-5-1M8 9l7 7" })] }) })] })] }));
}
function MobileNavigationTrigger({ label, onToggle, open, }) {
    return (_jsxs("button", { "aria-controls": "mobile-file-navigation", "aria-expanded": open, className: "mobile-navigation-trigger", onClick: onToggle, type: "button", children: [_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: open ? (_jsxs(_Fragment, { children: [_jsx("path", { d: "M6 6l12 12" }), _jsx("path", { d: "M18 6 6 18" })] })) : (_jsxs(_Fragment, { children: [_jsx("path", { d: "M4 7h16" }), _jsx("path", { d: "M4 12h16" }), _jsx("path", { d: "M4 17h16" })] })) }), _jsxs("span", { className: "mobile-navigation-context", children: [_jsx("span", { children: "Files" }), _jsx("span", { "aria-hidden": "true", children: "\u203A" }), _jsx("span", { className: "mobile-navigation-current", children: label })] })] }));
}
function DocumentErrorPanel({ errors, onNavigate, }) {
    return (_jsxs("section", { "aria-label": "Validation errors", className: "document-error-panel", id: "document-errors", children: [_jsx("div", { className: "document-error-header", children: "Validation errors" }), _jsx("div", { className: "document-error-list", children: errors.map((error, index) => (_jsxs("a", { className: "document-error-item", href: `#${error.anchor}`, onClick: onNavigate, children: [_jsxs("span", { className: "document-error-location", children: ["Line ", error.line] }), _jsx("span", { className: "document-error-message", children: error.message })] }, `${error.anchor}-${index}`))) })] }));
}
function currentLocation() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
function errorMessage(reason) {
    return reason instanceof Error ? reason.message : String(reason);
}
export function App() {
    const staticView = isStaticView();
    const searchEnabled = !staticView || staticViewSearchApi() !== null;
    const graphModeKey = graphModeStorageKey(staticViewBasePath());
    const [location, setLocation] = useState(currentLocation);
    const [index, setIndex] = useState(null);
    const [page, setPage] = useState(null);
    const [projectChange, setProjectChange] = useState({
        instanceId: staticView ? 'static' : '',
        generation: 0,
        markdownGeneration: 0,
    });
    const [error, setError] = useState('');
    const [indexError, setIndexError] = useState('');
    const [connectionRevision, setConnectionRevision] = useState(0);
    const [requestRevision, setRequestRevision] = useState(0);
    const [gitEnabled, setGitEnabled] = useState(true);
    const [graphMode, setGraphMode] = useState(() => {
        try {
            return (readGraphMode(window.localStorage, graphModeKey) ||
                viewPathname(window.location.pathname) === '/graph');
        }
        catch {
            return viewPathname(window.location.pathname) === '/graph';
        }
    });
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
    const [openErrorsFor, setOpenErrorsFor] = useState(null);
    const [sectionOutputId, setSectionOutputId] = useState(null);
    const [documentMode, setDocumentMode] = useState('view');
    const [historyScroll, setHistoryScroll] = useState(null);
    const [fragmentScroll, setFragmentScroll] = useState(null);
    const pageRef = useRef(page);
    pageRef.current = page;
    const documentDirty = useRef(false);
    const acceptedLocation = useRef(currentLocation());
    const pageRequestId = useRef(0);
    const positionedLocation = useRef(null);
    const routeLocation = useMemo(() => viewRouteIdentity(location), [location]);
    const route = useMemo(() => {
        const url = new URL(routeLocation, window.location.origin);
        const pathname = viewPathname(url.pathname);
        if (pathname === '/search')
            return { kind: 'search' };
        if (pathname === '/graph') {
            return {
                kind: 'graph',
                nodeId: graphNode(url.search),
                target: graphTarget(url.search),
            };
        }
        const markdown = documentPath(url.pathname);
        if (markdown)
            return { kind: 'markdown', path: markdown };
        const external = externalTarget(url.pathname, url.hash);
        if (external)
            return { kind: 'external', target: external.identity };
        const source = sourcePath(url.pathname);
        if (source) {
            const query = new URLSearchParams(url.search);
            const parsedLine = Number(query.get('line'));
            const parsedFocusLine = Number(query.get('at'));
            return {
                kind: 'source',
                path: source,
                symbol: sourceSymbol(url.hash),
                from: query.get('from') ?? '',
                line: Number.isInteger(parsedLine) && parsedLine > 0 ? parsedLine : 0,
                at: Number.isInteger(parsedFocusLine) && parsedFocusLine > 0
                    ? parsedFocusLine
                    : 0,
            };
        }
        return null;
    }, [routeLocation]);
    const graphActive = graphMode &&
        route !== null &&
        (route.kind === 'graph' ||
            route.kind === 'markdown' ||
            route.kind === 'source' ||
            route.kind === 'external');
    const graphSelectionTarget = route?.kind === 'graph' ? route.target : location;
    const graphSelectedNodeId = route?.kind === 'graph'
        ? route.nodeId
        : graphNodeIdForUrl(new URL(location, window.location.origin), route?.kind === 'external' && page?.kind === 'markdown'
            ? 'document'
            : route?.kind === 'external' && page?.kind === 'source'
                ? 'source'
                : undefined);
    const activePath = route?.kind === 'markdown' ? route.path : null;
    const editingDocument = !staticView &&
        route?.kind === 'markdown' &&
        !route.path.startsWith('@/') &&
        documentMode === 'edit';
    const activeExternalTarget = route?.kind === 'external' ? route.target : null;
    const gitHasChanges = Object.keys(index?.git?.files ?? NO_GIT_FILES).length > 0;
    const errorPanelKey = page?.kind === 'markdown'
        ? `${page.document.path}@${projectChange.generation}`
        : null;
    const errorsOpen = errorPanelKey !== null && openErrorsFor === errorPanelKey;
    const documentTree = useMemo(() => page?.kind === 'markdown'
        ? gitEnabled && page.document.gitTree
            ? page.document.gitTree
            : page.document.tree
        : null, [gitEnabled, page]);
    const mobileNavigationLabel = route?.kind === 'markdown' || route?.kind === 'source'
        ? route.path
        : route?.kind === 'external'
            ? route.target
            : route?.kind === 'search'
                ? 'Search'
                : 'Files';
    useEffect(() => {
        if (route?.kind !== 'graph')
            return;
        let target = route.target;
        try {
            const url = new URL(target, window.location.origin);
            if (url.origin !== window.location.origin ||
                (!documentPath(url.pathname) &&
                    !sourcePath(url.pathname) &&
                    !externalTarget(url.pathname, url.hash))) {
                target = '';
            }
            else {
                target = `${url.pathname}${url.search}${url.hash}`;
            }
        }
        catch {
            target = '';
        }
        if (!target && index)
            target = documentUrl(index.entry);
        if (!target)
            return;
        setPersistedGraphMode(true);
        window.history.replaceState(window.history.state, '', target);
        pageRequestId.current++;
        setPage(null);
        setLocation(currentLocation());
    }, [index, route]);
    useEffect(() => {
        setMobileNavigationOpen(false);
    }, [routeLocation]);
    useEffect(() => {
        setDocumentMode('view');
        documentDirty.current = false;
    }, [activePath]);
    useEffect(() => {
        const onBeforeUnload = (event) => {
            blockUnsavedChangesUnload(documentDirty.current, event);
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);
    useEffect(() => {
        if (!mobileNavigationOpen)
            return;
        const body = window.document.body;
        const navigation = window.document.getElementById('mobile-file-navigation');
        const activeLink = navigation?.querySelector('.document-link.active');
        body.classList.add('mobile-navigation-open');
        (activeLink ?? navigation)?.focus({ preventScroll: true });
        activeLink?.scrollIntoView({ block: 'center', behavior: 'instant' });
        const desktop = window.matchMedia('(min-width: 64rem)');
        const closeForDesktop = () => {
            if (desktop.matches)
                setMobileNavigationOpen(false);
        };
        const closeForEscape = (event) => {
            if (event.key !== 'Escape')
                return;
            setMobileNavigationOpen(false);
            window.document
                .querySelector('.mobile-navigation-trigger')
                ?.focus();
        };
        desktop.addEventListener('change', closeForDesktop);
        window.addEventListener('keydown', closeForEscape);
        return () => {
            body.classList.remove('mobile-navigation-open');
            desktop.removeEventListener('change', closeForDesktop);
            window.removeEventListener('keydown', closeForEscape);
        };
    }, [mobileNavigationOpen]);
    useEffect(() => {
        const onPopState = (event) => {
            const previousLocation = acceptedLocation.current;
            const nextLocation = currentLocation();
            const nextDocumentPath = documentPath(window.location.pathname);
            const nextExternal = externalTarget(window.location.pathname, window.location.hash);
            const preservesDocument = pageRef.current?.kind === 'markdown' &&
                (pageRef.current.document.path === nextDocumentPath ||
                    pageRef.current.document.path ===
                        (nextExternal
                            ? `${nextExternal.handle}:${nextExternal.path}`
                            : null));
            if (!preservesDocument &&
                !confirmDiscardUnsavedChanges(documentDirty.current, window.confirm.bind(window))) {
                window.history.pushState(null, '', previousLocation);
                return;
            }
            if (!preservesDocument)
                documentDirty.current = false;
            acceptedLocation.current = nextLocation;
            positionedLocation.current = null;
            setFragmentScroll(null);
            setHistoryScroll(historyScrollPosition(event.state));
            if (viewPathname(window.location.pathname) !== '/graph' &&
                !preservesDocument) {
                pageRequestId.current++;
                setPage(null);
            }
            setLocation(currentLocation());
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);
    useEffect(() => {
        if (staticView)
            return;
        const updateGeneration = (event) => {
            try {
                const change = JSON.parse(event.data);
                if (typeof change.instanceId !== 'string' ||
                    !Number.isInteger(change.generation) ||
                    !Number.isInteger(change.markdownGeneration)) {
                    return;
                }
                setProjectChange((current) => mergeProjectChange(current, change));
            }
            catch {
                // Ignore a malformed event; EventSource remains connected.
            }
        };
        const serverReady = (event) => {
            updateGeneration(event);
            setConnectionRevision((value) => value + 1);
        };
        return subscribeVisibleViewEvents(serverReady, updateGeneration);
    }, [staticView]);
    useEffect(() => {
        const controller = new AbortController();
        fetchViewJson('/api/index', controller.signal)
            .then((nextIndex) => {
            setIndex(nextIndex);
            setIndexError('');
        })
            .catch((reason) => {
            if (!controller.signal.aborted)
                setIndexError(errorMessage(reason));
        });
        return () => controller.abort();
    }, [connectionRevision, projectChange.generation]);
    useEffect(() => {
        const requestId = ++pageRequestId.current;
        if (!route) {
            setHistoryScroll(null);
            setPage(null);
            setError('This is not a document URL.');
            return;
        }
        if (route.kind === 'search' || route.kind === 'graph') {
            setError('');
            setPage({ kind: route.kind });
            return;
        }
        const controller = new AbortController();
        setError('');
        const request = route.kind === 'markdown'
            ? fetchViewJson(`/api/document?path=${encodeURIComponent(route.path)}`, controller.signal).then((document) => ({ kind: 'markdown', document }))
            : route.kind === 'external'
                ? fetchViewJson(`/api/external?target=${encodeURIComponent(route.target)}`, controller.signal).then((external) => external.kind === 'markdown'
                    ? {
                        kind: 'markdown',
                        document: external.document,
                    }
                    : {
                        kind: 'source',
                        source: external.source,
                    })
                : fetchViewJson(`/api/source?path=${encodeURIComponent(route.path)}&symbol=${encodeURIComponent(route.symbol)}&from=${encodeURIComponent(route.from)}&line=${route.line}&at=${route.at}`, controller.signal).then((source) => ({ kind: 'source', source }));
        request
            .then((nextPage) => {
            if (requestId !== pageRequestId.current)
                return;
            setPage(nextPage);
            setError('');
        })
            .catch((reason) => {
            if (requestId === pageRequestId.current && !controller.signal.aborted) {
                setPage(null);
                setHistoryScroll(null);
                setError(errorMessage(reason));
            }
        });
        return () => controller.abort();
    }, [connectionRevision, projectChange.generation, requestRevision, route]);
    useEffect(() => {
        if (!page)
            return;
        window.document.title = graphActive
            ? 'Graph · lat.md'
            : page.kind === 'search'
                ? 'Search · lat.md'
                : page.kind === 'graph'
                    ? 'Graph · lat.md'
                    : page.kind === 'markdown'
                        ? `${page.document.title} · lat.md`
                        : `${page.source.focus?.symbol ?? page.source.path} · lat.md`;
    }, [graphActive, page]);
    useLayoutEffect(() => {
        const matches = applySearchHighlights(window.document.querySelector('.markdown'), page?.kind === 'markdown'
            ? new URL(location, window.location.origin).search
            : '');
        if (!page || (positionedLocation.current === location && !fragmentScroll))
            return;
        setFragmentScroll(null);
        if (graphActive) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            positionedLocation.current = location;
            setHistoryScroll(null);
            return;
        }
        if (page.kind === 'search' || page.kind === 'graph') {
            if (historyScroll)
                return;
            window.scrollTo({ top: 0, behavior: 'instant' });
            positionedLocation.current = location;
            return;
        }
        if (historyScroll) {
            window.scrollTo({ ...historyScroll, behavior: 'instant' });
            positionedLocation.current = location;
            setHistoryScroll(null);
            return;
        }
        if (page.kind === 'markdown') {
            if (!fragmentScroll && matches[0]) {
                matches[0].scrollIntoView({ behavior: 'instant', block: 'center' });
            }
            else
                scrollToDocumentLocation(fragmentScroll?.hash ?? window.location.hash, {
                    getElementById: (id) => window.document.getElementById(id),
                    scrollTo: (options) => window.scrollTo(options),
                }, page.document.tableOfContents.find((item) => item.depth === 1)?.id);
        }
        else {
            const line = page.source.focus?.startLine;
            if (line) {
                window.document
                    .getElementById(sourceLineId(line))
                    ?.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
            else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        }
        positionedLocation.current = location;
    }, [
        graphActive,
        historyScroll,
        location,
        page,
        editingDocument,
        fragmentScroll,
    ]);
    function saveCurrentScroll() {
        window.history.replaceState(historyStateWithScroll(window.history.state, {
            left: window.scrollX,
            top: window.scrollY,
        }), '', currentLocation());
    }
    function setPersistedGraphMode(enabled) {
        setGraphMode(enabled);
        try {
            writeGraphMode(window.localStorage, graphModeKey, enabled);
        }
        catch {
            // Storage can be unavailable; the in-memory mode still works.
        }
    }
    function navigate(url) {
        const path = documentPath(url.pathname);
        if (path)
            url.pathname = documentUrl(path);
        const returnTo = currentLocation();
        const preservesDocument = page?.kind === 'markdown' &&
            (page.document.path === documentPath(url.pathname) ||
                page.document.path ===
                    (() => {
                        const external = externalTarget(url.pathname, url.hash);
                        return external ? `${external.handle}:${external.path}` : null;
                    })()) &&
            isSameRenderedDocument(new URL(window.location.href), url);
        const nextLocation = `${url.pathname}${url.search}${url.hash}`;
        // Explicit fragment navigation wins over search-result positioning. A new
        // request also repositions a repeated click without adding history entries.
        if (preservesDocument) {
            setHistoryScroll(null);
            setFragmentScroll({ hash: url.hash });
        }
        if (nextLocation === currentLocation()) {
            if (!page || error)
                retryPage();
            return;
        }
        if (!preservesDocument &&
            !confirmDiscardUnsavedChanges(documentDirty.current, window.confirm.bind(window))) {
            return;
        }
        if (!preservesDocument)
            documentDirty.current = false;
        if (!preservesDocument)
            setFragmentScroll(null);
        saveCurrentScroll();
        positionedLocation.current = null;
        setHistoryScroll(null);
        const state = viewPathname(url.pathname) === '/search' &&
            viewPathname(window.location.pathname) !== '/search'
            ? searchHistoryState(returnTo)
            : null;
        window.history.pushState(state, '', url);
        acceptedLocation.current = nextLocation;
        if (!preservesDocument) {
            pageRequestId.current++;
            setPage(null);
        }
        setLocation(currentLocation());
    }
    function retryPage() {
        positionedLocation.current = null;
        pageRequestId.current++;
        setHistoryScroll(null);
        setError('');
        setPage(null);
        setRequestRevision((value) => value + 1);
    }
    function closeSearch() {
        if (searchReturnTo(window.history.state)) {
            saveCurrentScroll();
            window.history.back();
            return;
        }
        if (!index) {
            window.location.assign('/');
            return;
        }
        positionedLocation.current = null;
        setHistoryScroll(null);
        window.history.replaceState(null, '', documentUrl(index.entry));
        pageRequestId.current++;
        setPage(null);
        setLocation(currentLocation());
    }
    function onNavigationClick(event) {
        if (event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey) {
            return;
        }
        setMobileNavigationOpen(false);
        event.preventDefault();
        navigate(new URL(event.currentTarget.href));
    }
    function onNavigationIntent(event) {
        const target = event.target;
        const anchor = target instanceof Element ? target.closest('a') : null;
        if (!anchor)
            return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin)
            return;
        const path = documentPath(url.pathname);
        if (path)
            void prefetchViewDocument(path).catch(() => { });
    }
    function onSearchToggleClick(event) {
        if (event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey) {
            return;
        }
        event.preventDefault();
        if (searchButtonAction(window.location.pathname) === 'close') {
            closeSearch();
            return;
        }
        navigate(new URL(event.currentTarget.href));
    }
    function onGraphToggleClick(event) {
        if (event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey) {
            return;
        }
        event.preventDefault();
        if (!graphMode &&
            !confirmDiscardUnsavedChanges(documentDirty.current, window.confirm.bind(window))) {
            return;
        }
        if (!graphMode)
            documentDirty.current = false;
        setPersistedGraphMode(!graphMode);
    }
    function onDocumentModeChange(mode) {
        if (mode === 'view' &&
            !confirmDiscardUnsavedChanges(documentDirty.current, window.confirm.bind(window))) {
            return;
        }
        if (mode === 'view')
            documentDirty.current = false;
        setDocumentMode(mode);
    }
    function onDocumentClick(event) {
        if (event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey) {
            return;
        }
        const target = event.target;
        const anchor = target instanceof Element ? target.closest('a') : null;
        if (!anchor || anchor.target || anchor.hasAttribute('download'))
            return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin ||
            (!documentPath(url.pathname) &&
                !sourcePath(url.pathname) &&
                !externalTarget(url.pathname, url.hash))) {
            return;
        }
        event.preventDefault();
        navigate(url);
    }
    if (graphActive) {
        const header = (_selectedNode, _selectedTarget) => (_jsx(AppHeader, { className: "graph-header", graphActive: graphActive, graphHref: currentLocation(), gitEnabled: gitEnabled, gitHasChanges: gitHasChanges, index: index, onGitToggle: () => setGitEnabled((enabled) => !enabled), onGraphNavigate: onGraphToggleClick, onNavigate: onNavigationClick, onSearchNavigate: onSearchToggleClick, route: route, searchEnabled: searchEnabled }));
        return (_jsxs("div", { className: "graph-shell", children: [_jsx(Suspense, { fallback: _jsx("div", { className: "state", children: "Loading graph\u2026" }), children: _jsx(GraphView, { generation: projectChange.generation, gitEnabled: gitEnabled, header: header, instanceId: projectChange.instanceId, markdownGeneration: projectChange.markdownGeneration, onNavigate: navigate, onShowSectionOutput: staticView ? undefined : setSectionOutputId, searchEnabled: searchEnabled, selectedNodeId: graphSelectedNodeId, target: graphSelectionTarget }) }), _jsx(SectionOutputDialog, { onClose: () => setSectionOutputId(null), sectionId: sectionOutputId })] }));
    }
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "sidebar", "data-mobile-navigation-open": mobileNavigationOpen || undefined, onMouseOver: onNavigationIntent, children: [_jsx(AppHeader, { className: "sidebar-header", graphActive: graphActive, graphHref: currentLocation(), gitEnabled: gitEnabled, gitHasChanges: gitHasChanges, index: index, onGitToggle: () => setGitEnabled((enabled) => !enabled), onGraphNavigate: onGraphToggleClick, onNavigate: onNavigationClick, onSearchNavigate: onSearchToggleClick, route: route, searchEnabled: searchEnabled }), _jsx(MobileNavigationTrigger, { label: mobileNavigationLabel, onToggle: () => setMobileNavigationOpen((open) => !open), open: mobileNavigationOpen }), _jsxs("nav", { "aria-label": "Project files", id: "mobile-file-navigation", tabIndex: -1, children: [index && (_jsx(FileTree, { activePath: activePath, activeExternalTarget: activeExternalTarget, errorCounts: index.errorCounts, externalFiles: index.externalFiles, files: index.files, directoryOrder: index.directoryOrder, entry: index.entry, gitFiles: gitEnabled ? (index.git?.files ?? NO_GIT_FILES) : NO_GIT_FILES, onNavigate: onNavigationClick })), !index && indexError && (_jsxs("div", { className: "sidebar-index-error", role: "alert", children: [_jsx("span", { children: indexError }), _jsx("button", { onClick: () => setConnectionRevision((value) => value + 1), type: "button", children: "Retry" })] }))] })] }), _jsx("main", { className: historyScroll ? 'main restoring-history-scroll' : 'main', onMouseOver: onNavigationIntent, children: error ? (_jsxs("div", { className: "state error", role: "alert", children: [_jsx("strong", { children: "Could not open this document" }), _jsx("span", { children: error }), route && route.kind !== 'search' && route.kind !== 'graph' && (_jsx("button", { className: "state-retry", onClick: retryPage, type: "button", children: "Retry" }))] })) : page?.kind === 'search' ? (_jsx(SearchPage, { onClose: closeSearch, onNavigate: onNavigationClick, onScrollRestored: () => {
                        positionedLocation.current = location;
                        setHistoryScroll(null);
                    }, markdownGeneration: projectChange.markdownGeneration, restoreScroll: historyScroll })) : page?.kind === 'markdown' ? (_jsxs("div", { className: "document-layout", children: [!editingDocument && (_jsx(DocumentToc, { gitEnabled: gitEnabled, items: page.document.tableOfContents, onNavigate: onNavigationClick })), _jsxs("div", { className: "document-column", children: [_jsxs("div", { className: "document-header", children: [_jsxs("div", { className: "document-header-line", children: [_jsxs("div", { className: "document-metadata", children: [_jsx("div", { className: "document-path", children: page.document.path.startsWith('@/')
                                                                ? page.document.path.slice(2)
                                                                : page.document.path }), page.document.frontmatter.requireCodeMention && (_jsx("div", { className: "document-flag", title: "Every leaf section must have an @lat code reference", children: "Code mentions required" })), page.document.errors.length > 0 && (_jsxs("button", { "aria-controls": "document-errors", "aria-expanded": errorsOpen, className: "document-error-toggle", onClick: () => setOpenErrorsFor(errorsOpen ? null : errorPanelKey), type: "button", children: [page.document.errors.length, ' ', page.document.errors.length === 1 ? 'error' : 'errors'] }))] }), !staticView &&
                                                    route?.kind === 'markdown' &&
                                                    !route.path.startsWith('@/') && (_jsx(DocumentModeSwitch, { mode: documentMode, onChange: onDocumentModeChange }))] }), errorsOpen && (_jsx(DocumentErrorPanel, { errors: page.document.errors, onNavigate: onNavigationClick }))] }), editingDocument && route?.kind === 'markdown' && (_jsx(Suspense, { fallback: _jsx("div", { className: "markdown-editor-state", children: "Loading editor\u2026" }), children: _jsx(MarkdownEditor, { active: true, onDirtyChange: (dirty) => {
                                            documentDirty.current = dirty;
                                        }, path: route.path, revision: projectChange.markdownGeneration }, route.path) })), !editingDocument && documentTree && (_jsx(MarkdownContent, { backReferences: page.document.backReferences, onClick: onDocumentClick, onCopySectionLink: (headingId) => navigateAndCopySectionLink(window.location.href, headingId, navigate, window.navigator.clipboard), onShowSectionOutput: setSectionOutputId, sectionOutputEnabled: !staticView &&
                                        !(route?.kind === 'markdown' && route.path.startsWith('@/')), tree: documentTree, viewMarkdownUrl: route?.kind === 'markdown' && !route.path.startsWith('@/')
                                        ? rawDocumentUrl(route.path)
                                        : undefined }))] })] })) : page?.kind === 'source' ? (_jsx(SourceView, { onContentClick: onDocumentClick, source: page.source }, `${page.source.path}#${page.source.focus?.symbol ?? ''}@${page.source.focus?.startLine ?? 0}`)) : (_jsx("div", { className: "state", children: "Loading\u2026" })) }), _jsx(SectionOutputDialog, { onClose: () => setSectionOutputId(null), sectionId: sectionOutputId })] }));
}
