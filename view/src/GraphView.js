import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MultiDirectedGraph } from 'graphology';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import Sigma from 'sigma';
import { graphFitCamera, graphViewportCamera, } from './graph-camera';
import { GraphNodeProgram, GraphSelectedNodeProgram, } from './graph-node-program';
import { createEdgeArrowProgram, EdgeLineProgram, } from 'sigma/rendering';
import { fetchViewJson } from './data-source';
import { MarkdownContent } from './MarkdownContent';
import { documentPath, externalTarget, graphInspectorLinkUrl, graphSelectionForUrl, graphTargetForNode, sourcePath, sourceSymbol, } from './navigation';
import { navigateAndCopySectionLink } from './section-back-references';
import { SourceView } from './SourceView';
import { deterministicGraphPosition, graphDisplayLabel, graphNodeSize, graphSearchNodeScores, graphSearchNodeSizes, staticGraphPositions, validGraphPosition, } from './graph-layout';
const positionCache = new Map();
let cameraCache = null;
let cameraViewportCache = null;
let cachedViewGraph = null;
let viewGraphRequest = null;
let viewGraphInstanceId = '';
const GRAPH_SEARCH_DEBOUNCE_MS = 220;
function nodeCategory(kind) {
    return kind === 'document' ? 'document' : 'code';
}
function colorValue(styles, name, fallback) {
    return styles.getPropertyValue(name).trim() || fallback;
}
const drawGraphNodeLabel = (context, data, settings) => {
    if (!data.label)
        return;
    const fontSize = settings.labelSize;
    const labelX = data.x + data.size + 4;
    const baselineY = data.y + fontSize / 3;
    context.save();
    context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
    // A narrow, theme-aware halo separates text from edges without label cards.
    const styles = getComputedStyle(document.documentElement);
    context.strokeStyle = colorValue(styles, '--sidebar', '#000');
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.strokeText(data.label, labelX, baselineY);
    context.fillStyle =
        data.labelColor || colorValue(styles, '--text', '#ededed');
    context.fillText(data.label, labelX, baselineY);
    context.restore();
};
function GraphCanvas({ graph: viewGraph, onSelect, searchNodeSizes, selectedNodeId, visibleNodes, }) {
    const container = useRef(null);
    const renderer = useRef(null);
    const selected = useRef(selectedNodeId);
    const searchSizes = useRef(searchNodeSizes);
    const visible = useRef(visibleNodes);
    const onSelectRef = useRef(onSelect);
    const fitCamera = useRef(() => { });
    useLayoutEffect(() => {
        selected.current = selectedNodeId;
        renderer.current?.refresh();
    }, [selectedNodeId]);
    useEffect(() => {
        visible.current = visibleNodes;
        renderer.current?.refresh();
    }, [visibleNodes]);
    useEffect(() => {
        searchSizes.current = searchNodeSizes;
        renderer.current?.refresh();
    }, [searchNodeSizes]);
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);
    useEffect(() => {
        const target = container.current;
        if (!target)
            return;
        const styles = window.getComputedStyle(target);
        const colors = {
            document: colorValue(styles, '--graph-document', '#ededed'),
            code: colorValue(styles, '--graph-code', '#737373'),
        };
        const mutedNodeColor = colorValue(styles, '--graph-node-muted', '#404040');
        const documentColor = colorValue(styles, '--graph-document-rest', '#999999');
        const codeColor = colorValue(styles, '--graph-code-rest', '#737373');
        const mutedLabelColor = colorValue(styles, '--muted', '#a1a1a1');
        const activeEdgeColor = colorValue(styles, '--graph-edge-active', '#686868');
        const edgeColor = colorValue(styles, '--graph-edge', '#505050');
        const mutedEdgeColor = colorValue(styles, '--graph-edge-muted', '#383838');
        const graph = new MultiDirectedGraph();
        const staticPositions = staticGraphPositions(viewGraph);
        for (const node of viewGraph.nodes) {
            const cachedPosition = positionCache.get(node.id);
            const position = validGraphPosition(cachedPosition)
                ? cachedPosition
                : (staticPositions.get(node.id) ?? deterministicGraphPosition(node.id));
            const backlinks = node.inDegree;
            graph.addNode(node.id, {
                ...position,
                label: graphDisplayLabel(node),
                backlinks,
                category: nodeCategory(node.kind),
                size: graphNodeSize(backlinks),
                color: colors[nodeCategory(node.kind)],
            });
        }
        for (const edge of viewGraph.edges) {
            if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to))
                continue;
            graph.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, {
                color: edgeColor,
                size: 0.4 + Math.log2(edge.weight + 1) * 0.15,
                type: 'line',
                weight: edge.weight,
            });
        }
        const savePositions = () => {
            graph.forEachNode((node, attributes) => {
                const position = { x: attributes.x, y: attributes.y };
                if (validGraphPosition(position))
                    positionCache.set(node, position);
                else
                    positionCache.delete(node);
            });
        };
        savePositions();
        let hoveredNode = '';
        const sigma = new Sigma(graph, target, {
            defaultEdgeColor: edgeColor,
            defaultEdgeType: 'arrow',
            nodeProgramClasses: {
                circle: GraphNodeProgram,
                selected: GraphSelectedNodeProgram,
            },
            defaultDrawNodeHover: drawGraphNodeLabel,
            defaultDrawNodeLabel: drawGraphNodeLabel,
            edgeProgramClasses: {
                line: EdgeLineProgram,
                arrow: createEdgeArrowProgram(),
            },
            hideEdgesOnMove: false,
            labelColor: { color: '#fff' },
            labelDensity: 0.3,
            labelFont: getComputedStyle(document.documentElement).fontFamily,
            labelRenderedSizeThreshold: 3,
            labelSize: 12,
            labelWeight: '400',
            minCameraRatio: 0.08,
            maxCameraRatio: 8,
            zoomingRatio: 1.104,
            renderEdgeLabels: false,
            stagePadding: 40,
            zIndex: true,
            nodeReducer: (node, data) => {
                if (!visible.current.has(node))
                    return { ...data, hidden: true };
                const searchSize = searchSizes.current?.get(node);
                const renderedData = searchSize === undefined ? data : { ...data, size: searchSize };
                const focus = hoveredNode || selected.current;
                const isSelected = node === selected.current;
                if (isSelected || node === focus) {
                    return {
                        ...renderedData,
                        type: isSelected ? 'selected' : 'circle',
                        forceLabel: true,
                        highlighted: true,
                        label: `${data.label} · ${data.backlinks} ${data.backlinks === 1 ? 'ref' : 'refs'}`,
                        zIndex: isSelected ? 4 : 3,
                    };
                }
                if (focus && node !== focus && !graph.areNeighbors(node, focus)) {
                    return {
                        ...renderedData,
                        color: mutedNodeColor,
                        label: data.category === 'document' ? data.label : null,
                        labelColor: mutedLabelColor,
                        zIndex: 0,
                    };
                }
                return {
                    ...renderedData,
                    color: focus
                        ? data.color
                        : data.color === colors.document
                            ? documentColor
                            : codeColor,
                    // Let Sigma resolve collisions; only the focus forces a label.
                    forceLabel: false,
                    zIndex: data.backlinks >= 4 ? 2 : 1,
                };
            },
            edgeReducer: (edge, data) => {
                const [from, to] = graph.extremities(edge);
                if (!visible.current.has(from) || !visible.current.has(to)) {
                    return { ...data, hidden: true };
                }
                const focus = hoveredNode || selected.current;
                if (focus && from !== focus && to !== focus) {
                    return {
                        ...data,
                        color: mutedEdgeColor,
                        size: 0.4,
                    };
                }
                return focus
                    ? {
                        ...data,
                        color: activeEdgeColor,
                        type: 'arrow',
                        size: data.size + 0.2,
                    }
                    : data;
            },
        });
        renderer.current = sigma;
        const viewport = () => ({
            ...sigma.getDimensions(),
            activeWidth: target.parentElement?.clientWidth ?? target.clientWidth,
        });
        let previousViewport = viewport();
        sigma.setSetting('zoomToSizeRatioFunction', (ratio) => Math.sqrt(ratio / graphFitCamera(viewport(), sigma.getGraphDimensions()).ratio));
        sigma
            .getCamera()
            .setState(cameraCache && cameraViewportCache
            ? graphViewportCamera(cameraCache, cameraViewportCache, previousViewport, sigma.getGraphDimensions())
            : graphFitCamera(previousViewport, sigma.getGraphDimensions()));
        sigma.on('resize', () => {
            const nextViewport = viewport();
            sigma
                .getCamera()
                .setState(graphViewportCamera(sigma.getCamera().getState(), previousViewport, nextViewport, sigma.getGraphDimensions()));
            previousViewport = nextViewport;
        });
        fitCamera.current = () => {
            const state = graphFitCamera(viewport(), sigma.getGraphDimensions());
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                sigma.getCamera().setState(state);
            }
            else {
                void sigma.getCamera().animate(state);
            }
        };
        sigma.on('enterNode', ({ node }) => {
            hoveredNode = node;
            sigma.refresh();
        });
        sigma.on('leaveNode', () => {
            hoveredNode = '';
            sigma.refresh();
        });
        sigma.on('clickNode', ({ node }) => onSelectRef.current(node));
        return () => {
            savePositions();
            cameraCache = sigma.getCamera().getState();
            cameraViewportCache = previousViewport;
            fitCamera.current = () => { };
            sigma.kill();
            renderer.current = null;
        };
    }, [viewGraph]);
    return (_jsxs("div", { className: "graph-canvas-shell", children: [_jsx("div", { "aria-label": "Interactive Lat reference graph", className: "graph-canvas", ref: container }), _jsx("button", { className: "graph-fit", onClick: () => fitCamera.current(), title: "Fit graph", type: "button", children: "Fit" })] }));
}
/** Warm the immutable graph projection so switching views does not wait on I/O. */
export function preloadViewGraph(minimumGeneration = 0, instanceId = '') {
    if (viewGraphInstanceId !== instanceId) {
        viewGraphInstanceId = instanceId;
        cachedViewGraph = null;
        viewGraphRequest = null;
    }
    if (cachedViewGraph && cachedViewGraph.generation >= minimumGeneration) {
        return Promise.resolve(cachedViewGraph);
    }
    if (viewGraphRequest) {
        return viewGraphRequest.then((graph) => graph.generation >= minimumGeneration
            ? graph
            : preloadViewGraph(minimumGeneration, instanceId));
    }
    const request = fetchViewJson('/api/graph').then((graph) => {
        if (viewGraphInstanceId === instanceId)
            cachedViewGraph = graph;
        return graph;
    });
    viewGraphRequest = request;
    void request.then(() => {
        if (viewGraphRequest === request)
            viewGraphRequest = null;
    }, () => {
        if (viewGraphRequest === request)
            viewGraphRequest = null;
    });
    return request;
}
function GraphInspector({ gitEnabled, graph, node, onSelect, onShowSectionOutput, target, }) {
    const [content, setContent] = useState(null);
    const [error, setError] = useState('');
    const inspector = useRef(null);
    const previewTarget = useMemo(() => node
        ? graphTargetForNode(graph, node, target, window.location.origin)
        : '', [graph, node, target]);
    const contentTarget = node?.kind === 'document' ? node.url : previewTarget;
    const documentTree = useMemo(() => content?.kind === 'markdown'
        ? gitEnabled && content.document.gitTree
            ? content.document.gitTree
            : content.document.tree
        : null, [content, gitEnabled]);
    useEffect(() => {
        const controller = new AbortController();
        setContent(null);
        setError('');
        if (!node)
            return () => controller.abort();
        const previewUrl = new URL(contentTarget || node.url, window.location.origin);
        const previewSource = sourcePath(previewUrl.pathname);
        const query = previewUrl.searchParams;
        const sourceQuery = new URLSearchParams({
            path: node.sourcePath ?? '',
            symbol: previewSource === node.sourcePath
                ? sourceSymbol(previewUrl.hash)
                : (node.symbol ?? ''),
            from: previewSource === node.sourcePath ? (query.get('from') ?? '') : '',
            line: previewSource === node.sourcePath ? (query.get('line') ?? '0') : '0',
            at: previewSource === node.sourcePath
                ? (query.get('at') ?? '0')
                : String(node.line ?? 0),
        });
        const request = node.externalTarget
            ? fetchViewJson(`/api/external?target=${encodeURIComponent(node.externalTarget)}`, controller.signal).then((external) => setContent(external.kind === 'markdown'
                ? { kind: 'markdown', document: external.document }
                : { kind: 'source', source: external.source }))
            : node.kind === 'document'
                ? fetchViewJson(`/api/document?path=${encodeURIComponent(node.documentPath ?? '')}`, controller.signal).then((document) => setContent({ kind: 'markdown', document }))
                : fetchViewJson(`/api/source?${sourceQuery}`, controller.signal).then((source) => setContent({ kind: 'source', source }));
        request.catch((reason) => {
            if (!controller.signal.aborted)
                setError(reason.message);
        });
        return () => controller.abort();
    }, [contentTarget, graph.generation, node]);
    useLayoutEffect(() => {
        const container = inspector.current;
        if (!container || !node || !content)
            return;
        container.scrollTop = 0;
        if (content.kind !== 'markdown')
            return;
        const hash = new URL(previewTarget || node.url, window.location.origin).hash.slice(1);
        if (!hash)
            return;
        let id = hash;
        try {
            id = decodeURIComponent(hash);
        }
        catch {
            // A malformed fragment simply leaves the document at its start.
        }
        container.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({
            block: 'start',
            behavior: 'instant',
        });
    }, [content, node, previewTarget]);
    function onContentClick(event) {
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
        const href = anchor.getAttribute('href');
        if (!href)
            return;
        const url = graphInspectorLinkUrl(href, previewTarget || node?.url || '/', window.location.origin);
        if (!url ||
            (!documentPath(url.pathname) &&
                !sourcePath(url.pathname) &&
                !externalTarget(url.pathname, url.hash))) {
            return;
        }
        event.preventDefault();
        const selection = graphSelectionForUrl(graph, url);
        if (selection)
            onSelect(selection.nodeId, selection.target);
    }
    if (!node) {
        return (_jsx("div", { className: "graph-inspector-empty", children: "Choose a document or code reference in the graph." }));
    }
    return (_jsx("div", { className: "graph-inspector-scroll", ref: inspector, children: error ? (_jsxs("div", { className: "state error", role: "alert", children: [_jsx("strong", { children: "Could not open this node" }), _jsx("span", { children: error })] })) : content?.kind === 'markdown' ? (_jsxs("div", { className: "graph-inspector-document", onClick: onContentClick, children: [_jsxs("div", { className: "document-metadata", children: [_jsx("div", { className: "document-path", children: content.document.path }), content.document.frontmatter.requireCodeMention && (_jsx("div", { className: "document-flag", children: "Code mentions required" })), content.document.errors.length > 0 && (_jsxs("div", { className: "document-error-toggle", children: [content.document.errors.length, ' ', content.document.errors.length === 1 ? 'error' : 'errors'] }))] }), documentTree && (_jsx(MarkdownContent, { backReferences: content.document.backReferences, onCopySectionLink: (headingId) => navigateAndCopySectionLink(new URL(contentTarget || previewTarget || node.url || '/', window.location.origin).href, headingId, (url) => {
                        const selection = graphSelectionForUrl(graph, url);
                        if (selection)
                            onSelect(selection.nodeId, selection.target);
                    }, window.navigator.clipboard), onShowSectionOutput: onShowSectionOutput, sectionOutputEnabled: Boolean(onShowSectionOutput), tree: documentTree }))] })) : content?.kind === 'source' ? (_jsx("div", { className: "graph-inspector-source", children: _jsx(SourceView, { onContentClick: onContentClick, source: content.source }, `${content.source.path}#${content.source.focus?.symbol ?? ''}@${content.source.focus?.startLine ?? 0}`) })) : (_jsx("div", { className: "state", children: "Loading node\u2026" })) }));
}
export default function GraphView({ generation, gitEnabled, header, instanceId, markdownGeneration, onNavigate, onShowSectionOutput, searchEnabled, selectedNodeId, target, }) {
    const [graph, setGraph] = useState(cachedViewGraph);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [searchMatch, setSearchMatch] = useState(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [categories, setCategories] = useState({
        document: true,
        code: true,
    });
    useEffect(() => {
        let cancelled = false;
        setError('');
        void preloadViewGraph(generation, instanceId)
            .then((nextGraph) => {
            if (!cancelled)
                setGraph(nextGraph);
        })
            .catch((reason) => {
            if (!cancelled)
                setError(reason.message);
        });
        return () => {
            cancelled = true;
        };
    }, [generation, instanceId]);
    const normalizedQuery = searchEnabled ? query.trim() : '';
    useEffect(() => {
        const controller = new AbortController();
        setSearchError('');
        setSearching(Boolean(normalizedQuery));
        if (!normalizedQuery) {
            setSearchMatch(null);
            return () => controller.abort();
        }
        const timeout = window.setTimeout(() => {
            void fetchViewJson(`/api/search?query=${encodeURIComponent(normalizedQuery)}`, controller.signal)
                .then((response) => {
                const pathScores = new Map();
                for (const result of response.results) {
                    pathScores.set(result.path, Math.max(pathScores.get(result.path) ?? -Infinity, result.rankScore));
                }
                setSearchMatch({
                    pathScores,
                    query: normalizedQuery,
                });
            })
                .catch((reason) => {
                if (!controller.signal.aborted)
                    setSearchError(reason.message);
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setSearching(false);
            });
        }, GRAPH_SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [markdownGeneration, normalizedQuery]);
    const semanticNodeScores = useMemo(() => {
        if (!graph || !normalizedQuery || searchMatch?.query !== normalizedQuery) {
            return null;
        }
        return graphSearchNodeScores(graph, searchMatch.pathScores);
    }, [graph, normalizedQuery, searchMatch]);
    const searchNodeSizes = useMemo(() => semanticNodeScores ? graphSearchNodeSizes(semanticNodeScores) : null, [semanticNodeScores]);
    const visibleNodes = useMemo(() => new Set((graph?.nodes ?? [])
        .filter((node) => categories[nodeCategory(node.kind)] &&
        (!semanticNodeScores || semanticNodeScores.has(node.id)))
        .map((node) => node.id)), [categories, graph, semanticNodeScores]);
    const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
    const selectedTarget = graph && selectedNode
        ? graphTargetForNode(graph, selectedNode, target, window.location.origin)
        : '';
    function selectNode(nodeId, exactTarget = '') {
        const node = graph?.nodes.find((candidate) => candidate.id === nodeId);
        if (!graph || !node)
            return;
        const next = graphTargetForNode(graph, node, exactTarget, window.location.origin);
        onNavigate(new URL(next, window.location.origin));
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "graph-topbar", children: _jsxs("div", { className: "graph-topbar-graph", children: [header(selectedNode, selectedTarget), _jsx("div", { className: "graph-tools", children: searchEnabled ? (_jsxs("label", { className: "graph-filter", children: [_jsx("span", { className: "visually-hidden", children: "Search graph with embeddings" }), _jsx("input", { autoComplete: "off", onChange: (event) => setQuery(event.currentTarget.value), placeholder: "Search graph\u2026", spellCheck: "false", type: "search", value: query }), _jsx("span", { "aria-live": "polite", className: "graph-node-count", children: searching
                                            ? 'Searching…'
                                            : `${visibleNodes.size} ${visibleNodes.size === 1 ? 'node' : 'nodes'}` })] })) : (_jsxs("span", { className: "graph-node-count", children: [visibleNodes.size, " ", visibleNodes.size === 1 ? 'node' : 'nodes'] })) })] }) }), error ? (_jsxs("div", { className: "state error graph-state", role: "alert", children: [_jsx("strong", { children: "Could not build the graph" }), _jsx("span", { children: error })] })) : !graph ? (_jsx("div", { className: "state graph-state", children: "Loading graph\u2026" })) : (_jsxs("div", { className: "graph-workspace", children: [_jsxs("section", { className: "graph-pane", children: [_jsx(GraphCanvas, { graph: graph, onSelect: selectNode, searchNodeSizes: searchNodeSizes, selectedNodeId: selectedNodeId, visibleNodes: visibleNodes }), _jsx("div", { "aria-label": "Graph node kinds", className: "graph-kind-filters graph-legend", children: ['document', 'code'].map((category) => (_jsxs("label", { className: category, children: [_jsx("input", { checked: categories[category], onChange: (event) => {
                                                const checked = event.currentTarget.checked;
                                                setCategories((current) => ({
                                                    ...current,
                                                    [category]: checked,
                                                }));
                                            }, type: "checkbox" }), _jsx("span", { children: category })] }, category))) }), _jsx("div", { className: "graph-encoding-note", children: searchNodeSizes
                                    ? 'Size: relevance'
                                    : 'Area: incoming refs · includes subsections' }), searchError ? (_jsx("div", { className: "graph-no-results", children: searchError })) : (!searching &&
                                visibleNodes.size === 0 && (_jsx("div", { className: "graph-no-results", children: "No nodes match this search." })))] }), _jsxs("aside", { className: "graph-inspector", children: [_jsx("div", { "aria-live": "polite", className: "visually-hidden", children: selectedNode
                                    ? `Selected ${selectedNode.label}`
                                    : 'No node selected' }), _jsx(GraphInspector, { gitEnabled: gitEnabled, graph: graph, node: selectedNode, onSelect: selectNode, onShowSectionOutput: onShowSectionOutput, target: selectedTarget })] })] }))] }));
}
