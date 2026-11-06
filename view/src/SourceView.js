import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef, useState } from 'react';
import { DocumentNodes } from './MarkdownContent';
import { captureScrollAnchor, restoreScrollAnchor, } from './scroll-anchor';
import { getSourceWindowRows } from './source-window';
export const sourceLineId = (line) => `source-line-${line}`;
function Breadcrumbs({ reference }) {
    return (_jsx("span", { className: "source-breadcrumbs", children: reference.breadcrumbs.map((part, index) => (_jsxs("span", { children: [index > 0 && _jsx("span", { "aria-hidden": "true", children: "\u203A" }), part] }, `${part}-${index}`))) }));
}
function SourceContext({ hasReferences, onContentClick, referencesOpen, setReferencesOpen, source, }) {
    return (_jsxs("section", { className: [
            'source-context',
            hasReferences ? 'has-references' : '',
            referencesOpen ? 'references-open' : '',
        ]
            .filter(Boolean)
            .join(' '), onClick: onContentClick, children: [_jsx("div", { className: "source-context-header", children: _jsx("span", { children: source.context ? 'Context' : 'References' }) }), source.context && (_jsxs("div", { className: "source-context-current", children: [_jsx("a", { href: source.context.url, children: _jsx(Breadcrumbs, { reference: source.context }) }), _jsx("div", { className: "source-context-paragraph", children: _jsx(DocumentNodes, { nodes: source.context.paragraphTree.children }) })] })), hasReferences && (_jsx("div", { className: "source-reference-toggle", children: _jsxs("button", { "aria-controls": "source-other-references", "aria-expanded": referencesOpen, onClick: () => setReferencesOpen(!referencesOpen), type: "button", children: [source.context ? 'Other references' : 'References', _jsx("span", { children: source.otherReferences.length })] }) })), referencesOpen && (_jsx("div", { className: "source-reference-list", id: "source-other-references", children: source.otherReferences.map((reference) => (_jsxs("div", { className: "source-reference-item", children: [_jsx("a", { href: reference.url, children: _jsx(Breadcrumbs, { reference: reference }) }), _jsx("div", { className: "source-reference-paragraph", children: _jsx(DocumentNodes, { nodes: reference.paragraphTree.children }) })] }, reference.sectionId))) }))] }));
}
function ExpandLines({ count, direction, onExpand, }) {
    return (_jsxs("div", { className: "source-collapse", children: [_jsx("span", { "aria-hidden": "true", children: "\u22EF" }), _jsxs("button", { onClick: onExpand, type: "button", children: ["Show ", count, " ", count === 1 ? 'line' : 'lines', " ", direction] })] }));
}
export function SourceView({ onContentClick, source, }) {
    const [referencesOpen, setReferencesOpen] = useState(false);
    const [expandedAbove, setExpandedAbove] = useState(false);
    const [expandedBelow, setExpandedBelow] = useState(false);
    const pendingScrollAnchor = useRef(null);
    const hasReferences = source.otherReferences.length > 0;
    const hasContext = Boolean(source.context || hasReferences);
    const rows = getSourceWindowRows(source.highlightedLines.length, source.focus, hasContext, expandedAbove, expandedBelow);
    useLayoutEffect(() => {
        const anchor = pendingScrollAnchor.current;
        if (!anchor)
            return;
        pendingScrollAnchor.current = null;
        restoreScrollAnchor(anchor, {
            getElementById: (id) => window.document.getElementById(id),
            scrollBy: (options) => window.scrollBy(options),
        });
    }, [expandedAbove]);
    function expandAbove() {
        const firstLine = rows.find((row) => row.kind === 'line');
        if (firstLine) {
            pendingScrollAnchor.current = captureScrollAnchor(sourceLineId(firstLine.lineNumber), {
                getElementById: (id) => window.document.getElementById(id),
            });
        }
        setExpandedAbove(true);
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "document-metadata", children: [_jsx("div", { className: "document-path", children: source.path }), source.focus && (_jsxs("div", { className: "document-flag", title: source.focus.signature, children: [source.focus.kind, " ", source.focus.symbol] }))] }), _jsx("div", { className: "source-code", "aria-label": `Source code for ${source.path}`, children: rows.map((row) => {
                    if (row.kind === 'context') {
                        return (_jsx(SourceContext, { hasReferences: hasReferences, onContentClick: onContentClick, referencesOpen: referencesOpen, setReferencesOpen: setReferencesOpen, source: source }, "context"));
                    }
                    if (row.kind === 'expand') {
                        return (_jsx(ExpandLines, { count: row.count, direction: row.direction, onExpand: () => row.direction === 'above'
                                ? expandAbove()
                                : setExpandedBelow(true) }, `expand-${row.direction}`));
                    }
                    const line = source.highlightedLines[row.lineNumber - 1];
                    return (_jsxs("div", { className: row.focused ? 'source-line focused' : 'source-line', id: sourceLineId(row.lineNumber), children: [_jsx("span", { className: "source-line-number", "aria-hidden": "true", children: row.lineNumber }), _jsx("code", { className: "source-line-content", children: line ? _jsx(DocumentNodes, { nodes: line.children }) : ' ' })] }, row.lineNumber));
                }) })] }));
}
