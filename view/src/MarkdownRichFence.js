import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { addMapGeometry, fallbackMapStyle, frameMap, geoJsonBounds, getMapLibre, getMermaid, getThreeModules, getTopoJson, nextMermaidDiagramId, OPENFREEMAP_STYLE_URL, parseGeoJson, parseStl, parseTopoJson, richFenceErrorMessage, } from './markdown-rich-fences';
const SVG_ELEMENTS = new Set([
    'a',
    'br',
    'circle',
    'clipPath',
    'defs',
    'desc',
    'div',
    'ellipse',
    'feBlend',
    'feColorMatrix',
    'feComposite',
    'feDropShadow',
    'feFlood',
    'feGaussianBlur',
    'feMerge',
    'feMergeNode',
    'feOffset',
    'filter',
    'foreignObject',
    'g',
    'image',
    'line',
    'linearGradient',
    'marker',
    'mask',
    'p',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialGradient',
    'rect',
    'small',
    'span',
    'stop',
    'style',
    'svg',
    'text',
    'title',
    'tspan',
    'use',
]);
function cssPropertyName(name) {
    if (name.startsWith('--'))
        return name;
    if (name.startsWith('-ms-'))
        name = name.slice(1);
    return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
function svgStyle(element) {
    const declaration = element.style;
    const result = {};
    for (let index = 0; index < declaration.length; index++) {
        const name = declaration.item(index);
        result[cssPropertyName(name)] = declaration.getPropertyValue(name);
    }
    return result;
}
function svgPropertyName(name) {
    if (name === 'class')
        return 'className';
    if (name === 'for')
        return 'htmlFor';
    if (name === 'tabindex')
        return 'tabIndex';
    if (name === 'xlink:href')
        return 'xlinkHref';
    if (name === 'xml:space')
        return 'xmlSpace';
    if (name.startsWith('aria-') || name.startsWith('data-'))
        return name;
    return name.replace(/[-:]([a-z])/g, (_match, letter) => letter.toUpperCase());
}
function safeSvgUrl(value) {
    return !/^\s*(?:javascript|vbscript|data):/i.test(value);
}
function svgNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return { type: 'text', value: node.textContent ?? '' };
    }
    if (node.nodeType !== Node.ELEMENT_NODE)
        return null;
    const element = node;
    const tagName = element.localName;
    if (!SVG_ELEMENTS.has(tagName))
        return null;
    const properties = {};
    for (const attribute of Array.from(element.attributes)) {
        const name = svgPropertyName(attribute.name);
        if (/^on/i.test(name))
            continue;
        if ((name === 'href' || name === 'xlinkHref') &&
            !safeSvgUrl(attribute.value)) {
            continue;
        }
        properties[name] = name === 'style' ? svgStyle(element) : attribute.value;
    }
    return {
        type: 'element',
        tagName,
        properties,
        children: Array.from(element.childNodes)
            .map(svgNode)
            .filter((child) => child !== null),
    };
}
export function parseMermaidSvg(source) {
    // Mermaid serializes HTML labels inside foreignObject with HTML void tags
    // such as <br>. Parse as inert HTML, then apply our element/property filter.
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const element = parsed.body.firstElementChild;
    if (!element ||
        element.localName !== 'svg' ||
        element.namespaceURI !== 'http://www.w3.org/2000/svg' ||
        parsed.body.children.length !== 1) {
        throw new Error('Mermaid did not return an SVG document');
    }
    const root = svgNode(element);
    if (!root || root.type !== 'element' || root.tagName !== 'svg') {
        throw new Error('Mermaid did not return an SVG document');
    }
    return root;
}
function renderSvgNode(node, key) {
    if (node.type === 'text')
        return node.value;
    return createElement(node.tagName, { ...node.properties, key }, ...node.children.map((child, index) => renderSvgNode(child, `${key}.${index}`)));
}
function FenceError({ fallback, label, message, onRetry, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "markdown-diagram-error markdown-map-error", role: "alert", children: [_jsxs("span", { children: ["Could not render ", label, ": ", message] }), _jsx("button", { className: "markdown-diagram-retry", onClick: onRetry, type: "button", children: "Retry" })] }), fallback] }));
}
// The overview shares the parsed SVG, but gets its own IDs and local references.
function overviewSvg(root) {
    const ids = new Map();
    const collect = (node) => {
        if (node.type === 'text')
            return;
        if (typeof node.properties.id === 'string')
            ids.set(node.properties.id, `${node.properties.id}-overview`);
        node.children.forEach(collect);
    };
    collect(root);
    const rewrite = (value) => {
        if (typeof value === 'string')
            return value.replace(/#([\w:.-]+)/g, (match, id) => ids.has(id) ? `#${ids.get(id)}` : match);
        if (value && typeof value === 'object')
            return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)]));
        return value;
    };
    const copy = (node) => {
        if (node.type === 'text')
            return node;
        const properties = Object.fromEntries(Object.entries(node.properties).map(([key, value]) => {
            if (key === 'id')
                return [key, ids.get(String(value))];
            if (key === 'aria-labelledby' || key === 'aria-describedby')
                return [
                    key,
                    String(value)
                        .split(/\s+/)
                        .map((id) => ids.get(id) || id)
                        .join(' '),
                ];
            return [key, rewrite(value)];
        }));
        return {
            ...node,
            properties,
            children: node.children.map((child) => node.tagName === 'style' && child.type === 'text'
                ? { ...child, value: rewrite(child.value) }
                : copy(child)),
        };
    };
    return copy(root);
}
function mermaidViewKey(source) {
    let hash = 2166136261;
    for (let index = 0; index < source.length; index++) {
        hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    }
    return `lat:mermaid-view:v1:${location.pathname}:${source.length}:${hash >>> 0}`;
}
function readMermaidView(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value &&
            [value.zoom, value.left, value.top].every(Number.isFinite) &&
            value.left >= 0 &&
            value.top >= 0)
            return {
                zoom: Math.max(0.3, Math.min(10, value.zoom)),
                left: value.left,
                top: value.top,
            };
    }
    catch {
        /* Storage may be unavailable or contain invalid data. */
    }
    return { zoom: 1, left: 0, top: 0 };
}
function MermaidViewport({ root, actions, viewState, storageKey, }) {
    const viewport = useRef(null);
    const previousZoom = useRef(viewState.zoom);
    const zoomAnchor = useRef(null);
    const pointers = useRef(new Map());
    const pinch = useRef(null);
    const safariGesture = useRef(null);
    const drag = useRef(null);
    const [zoom, setZoom] = useState(viewState.zoom);
    const overviewDrag = useRef(null);
    const suppressOverviewClick = useRef(false);
    const [frame, setFrame] = useState({ width: 1, height: 1, left: 0, top: 0 });
    const chart = useMemo(() => renderSvgNode(root, 'fullscreen-svg'), [root]);
    const overview = useMemo(() => renderSvgNode(overviewSvg(root), 'overview-svg'), [root]);
    const measure = useCallback(() => {
        const element = viewport.current;
        if (element)
            setFrame({
                width: Math.max(element.clientWidth, 1),
                height: Math.max(element.clientHeight, 1),
                left: element.scrollLeft,
                top: element.scrollTop,
            });
    }, []);
    useLayoutEffect(() => {
        const element = viewport.current;
        let restored = false;
        let timer;
        const save = () => {
            Object.assign(viewState, {
                zoom: previousZoom.current,
                left: element.scrollLeft,
                top: element.scrollTop,
            });
            try {
                localStorage.setItem(storageKey, JSON.stringify(viewState));
            }
            catch {
                /* Keep navigation usable when storage is disabled or full. */
            }
        };
        const restore = () => {
            if (!restored && element.clientWidth > 0 && element.clientHeight > 0) {
                element.scrollLeft = viewState.left;
                element.scrollTop = viewState.top;
                restored = true;
            }
            measure();
        };
        const scheduleSave = () => {
            clearTimeout(timer);
            timer = setTimeout(save, 200);
        };
        // Restore again after showModal gives the viewport its actual dimensions.
        element.scrollLeft = viewState.left;
        element.scrollTop = viewState.top;
        restore();
        const observer = new ResizeObserver(restore);
        observer.observe(element);
        element.addEventListener('scroll', scheduleSave);
        window.addEventListener('pagehide', save);
        return () => {
            clearTimeout(timer);
            save();
            observer.disconnect();
            element.removeEventListener('scroll', scheduleSave);
            window.removeEventListener('pagehide', save);
        };
    }, [measure, viewState, storageKey]);
    useLayoutEffect(() => {
        const element = viewport.current;
        const ratio = zoom / previousZoom.current;
        const anchor = zoomAnchor.current ?? {
            x: element.clientWidth / 2,
            y: element.clientHeight / 2,
        };
        if (zoom !== previousZoom.current) {
            element.scrollLeft = Math.max(0, Math.min(element.clientWidth * (zoom - 1), (element.scrollLeft +
                anchor.x -
                (element.clientWidth * Math.max(0, 1 - previousZoom.current)) / 2) *
                ratio +
                (element.clientWidth * Math.max(0, 1 - zoom)) / 2 -
                anchor.x));
            element.scrollTop = Math.max(0, Math.min(element.clientHeight * (zoom - 1), (element.scrollTop +
                anchor.y -
                (element.clientHeight * Math.max(0, 1 - previousZoom.current)) /
                    2) *
                ratio +
                (element.clientHeight * Math.max(0, 1 - zoom)) / 2 -
                anchor.y));
        }
        zoomAnchor.current = null;
        previousZoom.current = zoom;
        measure();
        if (element.clientWidth > 0) {
            Object.assign(viewState, {
                zoom,
                left: element.scrollLeft,
                top: element.scrollTop,
            });
            try {
                localStorage.setItem(storageKey, JSON.stringify(viewState));
            }
            catch {
                /* Optional persistence. */
            }
        }
    }, [zoom, measure, viewState, storageKey]);
    const changeZoom = (delta) => {
        zoomAnchor.current = null;
        setZoom((value) => Math.max(0.3, Math.min(10, value + delta)));
    };
    const gestureZoom = useCallback((value, clientX, clientY) => {
        const bounds = viewport.current.getBoundingClientRect();
        zoomAnchor.current = {
            x: clientX - bounds.left,
            y: clientY - bounds.top,
        };
        setZoom((current) => Math.max(0.3, Math.min(10, typeof value === 'function' ? value(current) : value)));
    }, []);
    useEffect(() => {
        const element = viewport.current;
        const wheel = (event) => {
            // Ordinary wheel/two-finger scrolling stays native panning.
            if (!event.ctrlKey)
                return;
            event.preventDefault();
            if (safariGesture.current)
                return;
            const delta = event.deltaY *
                (event.deltaMode === 1
                    ? 16
                    : event.deltaMode === 2
                        ? element.clientHeight
                        : 1);
            gestureZoom((value) => value * Math.exp(-delta * 0.01), event.clientX, event.clientY);
        };
        // Safari exposes trackpad pinches through GestureEvent instead of wheel.
        const start = (event) => {
            if (pointers.current.size >= 2)
                return;
            event.preventDefault();
            const gesture = event;
            safariGesture.current = {
                scale: gesture.scale || 1,
                zoom: previousZoom.current,
            };
        };
        const change = (event) => {
            if (!safariGesture.current)
                return;
            event.preventDefault();
            const gesture = event;
            gestureZoom((safariGesture.current.zoom * gesture.scale) /
                safariGesture.current.scale, gesture.clientX, gesture.clientY);
        };
        const end = () => {
            safariGesture.current = null;
        };
        element.addEventListener('wheel', wheel, { passive: false });
        element.addEventListener('gesturestart', start, { passive: false });
        element.addEventListener('gesturechange', change, { passive: false });
        element.addEventListener('gestureend', end);
        return () => {
            element.removeEventListener('wheel', wheel);
            element.removeEventListener('gesturestart', start);
            element.removeEventListener('gesturechange', change);
            element.removeEventListener('gestureend', end);
        };
    }, [gestureZoom]);
    const endPointer = (id) => {
        pointers.current.delete(id);
        pinch.current = null;
        drag.current = null;
        const remaining = [...pointers.current.values()][0];
        if (remaining && viewport.current)
            drag.current = {
                ...remaining,
                left: viewport.current.scrollLeft,
                top: viewport.current.scrollTop,
            };
    };
    const overviewWidth = Math.min(180, (120 * frame.width) / frame.height);
    const overviewHeight = (overviewWidth * frame.height) / frame.width;
    return (_jsxs("div", { className: "markdown-mermaid-viewer", children: [_jsx("div", { className: "markdown-mermaid-fullscreen-canvas", ref: viewport, tabIndex: 0, role: "region", "aria-label": "Diagram viewport. Pinch or use plus and minus to zoom; scroll or drag to pan.", "data-zoomed": zoom > 1, onScroll: measure, onDoubleClick: (event) => {
                    if (event.target.closest('a'))
                        return;
                    event.preventDefault();
                    zoomAnchor.current = null;
                    setZoom(1);
                }, onKeyDown: (event) => {
                    if (event.key === '+' || event.key === '=') {
                        event.preventDefault();
                        changeZoom(0.25);
                    }
                    else if (event.key === '-') {
                        event.preventDefault();
                        changeZoom(-0.25);
                    }
                    else if (event.key === '0') {
                        event.preventDefault();
                        setZoom(1);
                    }
                }, onPointerDown: (event) => {
                    if ((zoom <= 1 && event.pointerType !== 'touch') ||
                        event.button !== 0 ||
                        event.target.closest('a'))
                        return;
                    const element = event.currentTarget;
                    if (event.pointerType === 'touch') {
                        pointers.current.set(event.pointerId, {
                            x: event.clientX,
                            y: event.clientY,
                        });
                        if (pointers.current.size === 2) {
                            const [a, b] = [...pointers.current.values()];
                            pinch.current = {
                                distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                                zoom,
                            };
                        }
                    }
                    drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        left: element.scrollLeft,
                        top: element.scrollTop,
                    };
                    element.setPointerCapture(event.pointerId);
                    event.preventDefault();
                    element.focus();
                }, onPointerMove: (event) => {
                    if (pointers.current.has(event.pointerId)) {
                        pointers.current.set(event.pointerId, {
                            x: event.clientX,
                            y: event.clientY,
                        });
                        if (pointers.current.size >= 2 && pinch.current) {
                            const [a, b] = [...pointers.current.values()];
                            gestureZoom((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
                                pinch.current.distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
                            return;
                        }
                    }
                    if (!drag.current)
                        return;
                    event.currentTarget.scrollLeft =
                        drag.current.left + drag.current.x - event.clientX;
                    event.currentTarget.scrollTop =
                        drag.current.top + drag.current.y - event.clientY;
                }, onPointerUp: (event) => {
                    endPointer(event.pointerId);
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                }, onPointerCancel: (event) => endPointer(event.pointerId), onLostPointerCapture: (event) => endPointer(event.pointerId), children: _jsx("div", { className: "markdown-mermaid-zoom-stage", style: {
                        width: `${zoom * 100}%`,
                        height: `${zoom * 100}%`,
                        position: 'relative',
                        left: `${Math.max(0, 1 - zoom) * 50}%`,
                        top: `${Math.max(0, 1 - zoom) * 50}%`,
                    }, children: chart }) }), _jsxs("div", { className: "markdown-mermaid-zoom-controls", role: "group", "aria-label": "Diagram zoom", children: [_jsx("button", { className: "markdown-mermaid-button", type: "button", "aria-label": "Zoom out", disabled: zoom === 0.3, onClick: () => changeZoom(-0.25), children: "\u2212" }), _jsxs("span", { "aria-live": "polite", children: [Math.round(zoom * 100), "%"] }), _jsx("button", { className: "markdown-mermaid-button", type: "button", "aria-label": "Zoom in", disabled: zoom === 10, onClick: () => changeZoom(0.25), children: "+" }), _jsx("button", { className: "markdown-mermaid-button", type: "button", onClick: () => setZoom(1), children: "Fit to screen" }), actions] }), zoom > 1 && (_jsxs("button", { className: "markdown-mermaid-minimap", type: "button", "aria-label": "Diagram overview. Drag the viewport box or click to navigate; press Enter to center.", style: { width: overviewWidth, height: overviewHeight }, onPointerDown: (event) => {
                    suppressOverviewClick.current = false;
                    if (event.button !== 0 || overviewDrag.current)
                        return;
                    if (!event.target.closest('.markdown-mermaid-minimap-frame'))
                        return;
                    const element = viewport.current;
                    overviewDrag.current = {
                        pointerId: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        left: element.scrollLeft,
                        top: element.scrollTop,
                    };
                    suppressOverviewClick.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    event.currentTarget.focus();
                    event.preventDefault();
                }, onPointerMove: (event) => {
                    const start = overviewDrag.current;
                    if (!start || start.pointerId !== event.pointerId)
                        return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const element = viewport.current;
                    element.scrollLeft = Math.max(0, Math.min(element.clientWidth * (zoom - 1), start.left +
                        ((event.clientX - start.x) / bounds.width) *
                            element.clientWidth *
                            zoom));
                    element.scrollTop = Math.max(0, Math.min(element.clientHeight * (zoom - 1), start.top +
                        ((event.clientY - start.y) / bounds.height) *
                            element.clientHeight *
                            zoom));
                    measure();
                }, onPointerUp: (event) => {
                    if (overviewDrag.current?.pointerId !== event.pointerId)
                        return;
                    overviewDrag.current = null;
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                }, onPointerCancel: () => {
                    overviewDrag.current = null;
                }, onLostPointerCapture: () => {
                    overviewDrag.current = null;
                }, onClick: (event) => {
                    if (suppressOverviewClick.current && event.detail !== 0) {
                        suppressOverviewClick.current = false;
                        return;
                    }
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const x = event.detail === 0
                        ? 0.5
                        : Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
                    const y = event.detail === 0
                        ? 0.5
                        : Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
                    const element = viewport.current;
                    element.scrollLeft = x * frame.width * zoom - frame.width / 2;
                    element.scrollTop = y * frame.height * zoom - frame.height / 2;
                    measure();
                }, children: [_jsx("div", { className: "markdown-mermaid-minimap-chart", "aria-hidden": "true", inert: true, children: overview }), _jsx("span", { className: "markdown-mermaid-minimap-frame", style: {
                            width: `${100 / zoom}%`,
                            height: `${100 / zoom}%`,
                            left: `${(frame.left / (frame.width * zoom)) * 100}%`,
                            top: `${(frame.top / (frame.height * zoom)) * 100}%`,
                        } })] }))] }));
}
function MermaidFence({ fallback, source }) {
    const container = useRef(null);
    const dialog = useRef(null);
    const viewState = useRef({ zoom: 1, left: 0, top: 0 });
    const storageKey = useRef('');
    const [fullscreen, setFullscreen] = useState(false);
    const [raw, setRaw] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [rendered, setRendered] = useState(null);
    useEffect(() => {
        let active = true;
        setError('');
        setRendered(null);
        setFullscreen(false);
        setRaw(false);
        void getMermaid()
            .then((mermaid) => mermaid.render(nextMermaidDiagramId(), source))
            .then((result) => {
            if (!active)
                return;
            setRendered({
                root: parseMermaidSvg(result.svg),
                bind: result.bindFunctions,
            });
        })
            .catch((reason) => {
            if (active)
                setError(richFenceErrorMessage(reason));
        });
        return () => {
            active = false;
        };
    }, [attempt, source]);
    useLayoutEffect(() => {
        if (fullscreen)
            dialog.current?.showModal();
        else if (dialog.current?.open)
            dialog.current.close();
        if (!raw && rendered?.bind && container.current)
            rendered.bind(container.current);
    }, [rendered, fullscreen, raw]);
    if (error) {
        return (_jsx(FenceError, { fallback: fallback, label: "Mermaid diagram", message: error, onRetry: () => setAttempt((value) => value + 1) }));
    }
    if (!rendered)
        return fallback;
    const rawToggle = (_jsx("button", { className: "markdown-mermaid-button", type: "button", onClick: () => setRaw((value) => !value), children: raw ? 'View chart' : 'View raw' }));
    const fullscreenActions = (_jsxs(_Fragment, { children: [rawToggle, _jsx("button", { className: "markdown-mermaid-button", type: "button", autoFocus: true, onClick: () => setFullscreen(false), children: "Close full screen" })] }));
    const content = raw ? (_jsx("pre", { className: "markdown-mermaid-source", children: _jsx("code", { children: source }) })) : (renderSvgNode(rendered.root, 'svg'));
    return (_jsxs("div", { "aria-label": "Mermaid diagram", className: "markdown-diagram markdown-mermaid", ref: container, role: "group", children: [_jsxs("div", { className: "markdown-mermaid-toolbar", children: [rawToggle, _jsx("button", { className: "markdown-mermaid-button", type: "button", "aria-label": "View Mermaid diagram full screen", title: "Full screen", onClick: () => {
                            storageKey.current = mermaidViewKey(source);
                            viewState.current = readMermaidView(storageKey.current);
                            setFullscreen(true);
                        }, children: _jsx("svg", { "aria-hidden": "true", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" }) }) })] }), !fullscreen && content, _jsx("dialog", { "aria-label": "Full-screen Mermaid diagram", className: "markdown-mermaid-fullscreen", ref: dialog, onClose: () => setFullscreen(false), onCancel: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFullscreen(false);
                }, onKeyDown: (event) => {
                    if (event.key === 'Escape')
                        event.stopPropagation();
                }, children: fullscreen &&
                    (raw ? (_jsxs("div", { className: "markdown-mermaid-viewer", children: [_jsx("div", { className: "markdown-mermaid-fullscreen-canvas markdown-mermaid-raw-canvas", children: content }), _jsx("div", { className: "markdown-mermaid-zoom-controls", role: "group", "aria-label": "Diagram controls", children: fullscreenActions })] })) : (_jsx(MermaidViewport, { root: rendered.root, actions: fullscreenActions, viewState: viewState.current, storageKey: storageKey.current }))) })] }));
}
function MapFence({ fallback, kind, source, }) {
    const canvas = useRef(null);
    const figure = useRef(null);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('loading');
    const label = kind === 'topojson' ? 'TopoJSON map' : 'GeoJSON map';
    useLayoutEffect(() => {
        let active = true;
        let fallbackTimer = null;
        let map = null;
        setError('');
        setStatus('loading');
        void Promise.all([
            getMapLibre(),
            kind === 'topojson' ? getTopoJson() : Promise.resolve(null),
        ])
            .then(([maplibre, topojson]) => {
            if (!active || !canvas.current || !figure.current)
                return;
            const data = kind === 'topojson'
                ? parseTopoJson(source, topojson)
                : parseGeoJson(source);
            const color = getComputedStyle(figure.current).getPropertyValue('--link').trim() ||
                '#0969da';
            map = new maplibre.Map({
                attributionControl: { compact: false },
                container: canvas.current,
                scrollZoom: false,
                style: OPENFREEMAP_STYLE_URL,
            });
            map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left');
            frameMap(map, geoJsonBounds(data));
            let styleLoaded = false;
            let usingFallback = false;
            const fail = (reason) => {
                if (active)
                    setError(richFenceErrorMessage(reason));
            };
            const activateFallback = (reason) => {
                if (!active || styleLoaded || usingFallback || !map)
                    return;
                usingFallback = true;
                setStatus('fallback');
                figure.current?.setAttribute('title', `Basemap unavailable; showing supplied geometry only: ${richFenceErrorMessage(reason)}`);
                map.setStyle(fallbackMapStyle(), { diff: false });
            };
            fallbackTimer = window.setTimeout(() => activateFallback(new Error('OpenFreeMap request timed out')), 10_000);
            map.on('style.load', () => {
                if (!active || !map)
                    return;
                try {
                    addMapGeometry(map, data, color);
                    styleLoaded = true;
                    if (fallbackTimer !== null)
                        window.clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                    setStatus(usingFallback ? 'fallback' : 'ready');
                    if (!usingFallback)
                        figure.current?.removeAttribute('title');
                }
                catch (reason) {
                    fail(reason);
                }
            });
            map.on('error', (event) => activateFallback(event.error));
        })
            .catch((reason) => {
            if (active)
                setError(richFenceErrorMessage(reason));
        });
        return () => {
            active = false;
            if (fallbackTimer !== null)
                window.clearTimeout(fallbackTimer);
            map?.remove();
        };
    }, [attempt, kind, source]);
    if (error) {
        return (_jsx(FenceError, { fallback: fallback, label: label, message: error, onRetry: () => setAttempt((value) => value + 1) }));
    }
    return (_jsxs("figure", { "aria-busy": status === 'loading', "aria-label": label, className: "markdown-diagram markdown-map", "data-basemap-status": status, ref: figure, children: [_jsx("div", { className: "markdown-map-canvas", ref: canvas }), status === 'loading' && (_jsxs("div", { className: "markdown-map-status", role: "status", children: ["Loading ", label, "\u2026"] }))] }));
}
function StlCanvas({ modules, onError, source, }) {
    const canvas = useRef(null);
    const viewport = useRef(null);
    useLayoutEffect(() => {
        if (!canvas.current || !viewport.current)
            return;
        const disposers = [];
        try {
            const { OrbitControls, STLLoader, three } = modules;
            const geometry = parseStl(source, STLLoader);
            disposers.push(() => geometry.dispose());
            geometry.computeBoundingBox();
            const center = geometry.boundingBox.getCenter(new three.Vector3());
            geometry.translate(-center.x, -center.y, -center.z);
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            const radius = Math.max(geometry.boundingSphere?.radius ?? 0, 0.001);
            const scene = new three.Scene();
            const camera = new three.PerspectiveCamera(42, 1, radius / 100, radius * 100);
            const distance = radius * 3.2;
            camera.position.set(distance, distance * 0.72, distance);
            camera.lookAt(0, 0, 0);
            const renderer = new three.WebGLRenderer({
                antialias: true,
                alpha: true,
                canvas: canvas.current,
            });
            disposers.push(() => renderer.dispose());
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            const figure = canvas.current.closest('.markdown-stl');
            const color = (figure &&
                getComputedStyle(figure).getPropertyValue('--link').trim()) ||
                '#0070f3';
            const material = new three.MeshStandardMaterial({
                color: new three.Color().setStyle(color),
                metalness: 0.08,
                roughness: 0.72,
            });
            disposers.push(() => material.dispose());
            scene.add(new three.Mesh(geometry, material));
            scene.add(new three.HemisphereLight(0xffffff, 0x777777, 2.25));
            const keyLight = new three.DirectionalLight(0xffffff, 2.5);
            keyLight.position.set(distance, distance * 1.5, distance);
            scene.add(keyLight);
            const grid = new three.GridHelper(radius * 4, 12, 0x777777, 0xaaaaaa);
            disposers.push(() => {
                grid.geometry.dispose();
                if (Array.isArray(grid.material)) {
                    for (const material of grid.material)
                        material.dispose();
                }
                else {
                    grid.material.dispose();
                }
            });
            grid.position.y = geometry.boundingBox?.min.y ?? -radius;
            scene.add(grid);
            const controls = new OrbitControls(camera, canvas.current);
            controls.target.set(0, 0, 0);
            controls.enableDamping = false;
            controls.maxDistance = radius * 12;
            controls.minDistance = radius * 1.1;
            controls.listenToKeyEvents(canvas.current);
            controls.update();
            disposers.push(() => {
                controls.stopListenToKeyEvents();
                controls.dispose();
            });
            const render = () => renderer.render(scene, camera);
            const resize = () => {
                if (!viewport.current)
                    return;
                const width = Math.max(viewport.current.clientWidth, 1);
                const height = Math.max(viewport.current.clientHeight, 1);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
                render();
            };
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(viewport.current);
            disposers.push(() => resizeObserver.disconnect());
            controls.addEventListener('change', render);
            disposers.push(() => controls.removeEventListener('change', render));
            resize();
        }
        catch (reason) {
            for (const dispose of disposers.splice(0).reverse())
                dispose();
            onError(reason);
        }
        return () => {
            for (const dispose of disposers.splice(0).reverse())
                dispose();
        };
    }, [modules, onError, source]);
    return (_jsx("div", { className: "markdown-stl-viewport", ref: viewport, children: _jsx("canvas", { "aria-label": "Interactive 3D model. Drag to rotate and scroll to zoom.", ref: canvas, tabIndex: 0 }) }));
}
function StlFence({ fallback, source }) {
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [modules, setModules] = useState(null);
    useEffect(() => {
        let active = true;
        setError('');
        setModules(null);
        void getThreeModules()
            .then((value) => {
            if (active)
                setModules(value);
        })
            .catch((reason) => {
            if (active)
                setError(richFenceErrorMessage(reason));
        });
        return () => {
            active = false;
        };
    }, [attempt, source]);
    const fail = useCallback((reason) => {
        setError(richFenceErrorMessage(reason));
    }, []);
    if (error) {
        return (_jsx(FenceError, { fallback: fallback, label: "ASCII STL model", message: error, onRetry: () => setAttempt((value) => value + 1) }));
    }
    if (!modules)
        return fallback;
    return (_jsxs("figure", { "aria-label": "ASCII STL 3D model", className: "markdown-diagram markdown-stl", children: [_jsx(StlCanvas, { modules: modules, onError: fail, source: source }), _jsx("figcaption", { className: "markdown-stl-caption", children: "Drag to rotate \u00B7 Scroll to zoom" })] }));
}
/** Render a rich Markdown fence as a React-owned browser component. */
export function MarkdownRichFence(props) {
    switch (props.kind) {
        case 'mermaid':
            return _jsx(MermaidFence, { fallback: props.fallback, source: props.source });
        case 'geojson':
        case 'topojson':
            return _jsx(MapFence, { ...props, kind: props.kind });
        case 'stl':
            return _jsx(StlFence, { fallback: props.fallback, source: props.source });
    }
}
