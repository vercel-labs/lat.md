import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { wikiLinkSyntax } from '@lat.md/core/extensions/wiki-link/syntax';
import { wikiLinkFromMarkdown } from '@lat.md/core/extensions/wiki-link/from-markdown';
import { searchResultUrl } from './search-highlights';
/** Preview only: render Markdown structure without executing HTML or loading assets. */
function previewNode(node, key) {
    const children = 'children' in node ? node.children.map(previewNode) : null;
    switch (node.type) {
        case 'root':
            return children;
        case 'paragraph':
            return _jsx("p", { children: children }, key);
        case 'heading':
            return (_jsx("p", { children: _jsx("strong", { children: children }) }, key));
        case 'text':
            return node.value;
        case 'inlineCode':
            return _jsx("code", { children: node.value }, key);
        case 'wikiLink':
            return (_jsx("code", { title: node.value, children: node.data.alias ?? node.value }, key));
        case 'code':
            return (_jsx("pre", { children: _jsx("code", { children: node.value }) }, key));
        case 'strong':
            return _jsx("strong", { children: children }, key);
        case 'emphasis':
            return _jsx("em", { children: children }, key);
        case 'blockquote':
            return _jsx("blockquote", { children: children }, key);
        case 'list':
            return node.ordered ? (_jsx("ol", { start: node.start ?? 1, children: children }, key)) : (_jsx("ul", { children: children }, key));
        case 'listItem':
            return _jsx("li", { children: children }, key);
        case 'break':
            return _jsx("br", {}, key);
        case 'thematicBreak':
            return _jsx("hr", {}, key);
        case 'table':
            return (_jsx("div", { className: "search-preview-table", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: node.children[0]?.children.map((cell, i) => (_jsx("th", { children: cell.children.map(previewNode) }, i))) }) }), _jsx("tbody", { children: node.children.slice(1).map(previewNode) })] }) }, key));
        case 'tableRow':
            return _jsx("tr", { children: children }, key);
        case 'tableCell':
            return _jsx("td", { children: children }, key);
        case 'image':
        case 'imageReference':
            return node.alt;
        case 'html':
            return node.value;
        case 'definition':
            return null;
        default:
            return children;
    }
}
export function SearchResultCard({ result, rank, onNavigate, }) {
    const [expanded, setExpanded] = useState(false);
    const passage = result.evidence[0];
    const text = passage?.text ?? result.description;
    const preview = useMemo(() => previewNode(fromMarkdown(text, {
        extensions: [gfmTable(), wikiLinkSyntax()],
        mdastExtensions: [gfmTableFromMarkdown(), wikiLinkFromMarkdown()],
    }), 0), [text]);
    const expandable = text.length > 360 || text.split('\n').length > 6;
    const spans = passage?.spans ?? [];
    const lines = spans
        .map((span) => span.startLine === span.endLine
        ? `${span.startLine}`
        : `${span.startLine}–${span.endLine}`)
        .join(', ');
    const hasLexical = result.lexicalRank !== undefined;
    const hasSemantic = result.semanticRank !== undefined;
    const match = hasLexical && hasSemantic
        ? 'Text + semantic'
        : hasLexical
            ? 'Text match'
            : hasSemantic
                ? 'Semantic match'
                : null;
    return (_jsxs("article", { className: "search-result", children: [_jsxs("div", { className: "search-result-heading", children: [_jsxs("a", { className: "search-result-link", href: searchResultUrl(result.url, spans), onClick: onNavigate, children: [_jsx("span", { className: "search-result-breadcrumbs", children: result.breadcrumbs.slice(0, -1).join(' › ') }), _jsxs("h2", { children: [_jsxs("span", { className: "search-result-rank", children: [rank, "."] }), " ", result.title] })] }), _jsxs("details", { className: "search-result-score", children: [_jsxs("summary", { "aria-label": `Hybrid score ${result.rankScore.toFixed(6)}; show score details`, children: [_jsx("span", { children: "Hybrid score" }), _jsx("strong", { children: result.rankScore.toFixed(6) })] }), _jsxs("div", { className: "search-score-details", children: [_jsx("p", { children: "Combines text and semantic ranks. Higher is better within this search; this is not a confidence percentage." }), _jsxs("dl", { children: [_jsxs("div", { children: [_jsx("dt", { children: "Text rank" }), _jsx("dd", { children: result.lexicalRank ?? 'No match' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Semantic rank" }), _jsx("dd", { children: result.semanticRank ?? 'No match' })] }), result.semanticSimilarity !== undefined && (_jsxs("div", { children: [_jsx("dt", { children: "Cosine similarity" }), _jsx("dd", { children: result.semanticSimilarity.toFixed(3) })] }))] })] })] })] }), _jsxs("div", { className: "search-result-meta", children: [match && _jsx("span", { children: match }), lines && _jsxs("span", { children: ["Matched lines ", lines] })] }), _jsx("div", { className: `search-passage${expandable && !expanded ? ' search-passage-collapsed' : ''}`, children: preview }), expandable && (_jsx("button", { className: "search-passage-toggle", type: "button", "aria-expanded": expanded, onClick: () => setExpanded(!expanded), children: expanded ? 'Show less' : 'Show full passage' }))] }));
}
