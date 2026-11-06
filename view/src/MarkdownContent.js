import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement, useState, } from 'react';
import { MarkdownRichFence, } from './MarkdownRichFence';
import { copySectionId } from './section-back-references';
import { CodeBlock } from './CodeBlock';
const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);
function reactAttributeName(name) {
    if (/^(?:aria|data)[A-Z]/.test(name)) {
        return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    }
    if (name === 'xLinkHref')
        return 'xlinkHref';
    return name;
}
function reactStyle(value) {
    const style = {};
    for (const declaration of value.split(';')) {
        const colon = declaration.indexOf(':');
        if (colon < 0)
            continue;
        const name = declaration.slice(0, colon).trim();
        const item = declaration.slice(colon + 1).trim();
        if (!name || !item)
            continue;
        const property = name.startsWith('--')
            ? name
            : name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        style[property] = item;
    }
    return style;
}
function reactProperty(name, value) {
    if (/^on/i.test(name) ||
        name === 'dangerouslySetInnerHTML' ||
        name === 'srcDoc') {
        return undefined;
    }
    if (['href', 'src', 'action', 'formAction'].includes(name) &&
        typeof value === 'string' &&
        /^\s*(?:javascript|vbscript):/i.test(value)) {
        return undefined;
    }
    if (name === 'style' && typeof value === 'string')
        return reactStyle(value);
    if (Array.isArray(value))
        return value.join(' ');
    return value;
}
function elementProperties(node, key) {
    const properties = { key };
    for (const [sourceName, value] of Object.entries(node.properties)) {
        const name = reactAttributeName(sourceName);
        const normalized = reactProperty(name, value);
        if (normalized !== undefined)
            properties[name] = normalized;
    }
    return properties;
}
function documentNodeText(node) {
    if (node.type === 'text')
        return node.value;
    return node.children.map(documentNodeText).join('');
}
function richFenceKind(node) {
    if (node.tagName !== 'pre')
        return null;
    const value = node.properties.className;
    const classNames = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string'
            ? value.split(/\s+/)
            : [];
    if (classNames.includes('markdown-mermaid-source'))
        return 'mermaid';
    if (classNames.includes('markdown-geojson-source'))
        return 'geojson';
    if (classNames.includes('markdown-topojson-source'))
        return 'topojson';
    if (classNames.includes('markdown-stl-source'))
        return 'stl';
    return null;
}
function CodeReference({ reference }) {
    const extension = reference.path.slice(reference.path.lastIndexOf('.'));
    const language = new Map([
        ['.ts', ['code-language-ts', 'TS']],
        ['.tsx', ['code-language-ts', 'TS']],
        ['.js', ['code-language-js', 'JS']],
        ['.jsx', ['code-language-js', 'JS']],
        ['.py', ['code-language-py', 'PY']],
        ['.rs', ['code-language-rs', 'RS']],
        ['.go', ['code-language-go', 'GO']],
        ['.c', ['code-language-c', 'C']],
        ['.h', ['code-language-c', 'C']],
        ['.dart', ['code-language-dart', 'DART']],
        ['.swift', ['code-language-swift', 'SWIFT']],
        ['.java', ['code-language-java', 'JAVA']],
    ]).get(extension.toLowerCase()) ?? ['', '</>'];
    return (_jsxs("div", { className: "section-back-reference-item section-back-reference-code", children: [_jsxs("a", { className: "section-back-reference-location", href: reference.url, children: [_jsx("span", { "aria-hidden": "true", className: ['code-link-language', language[0]]
                            .filter(Boolean)
                            .join(' '), children: language[1] }), _jsxs("span", { children: [reference.path, ":", reference.line] })] }), _jsx("code", { children: reference.snippet })] }));
}
function MarkdownReference({ reference, }) {
    return (_jsxs("div", { className: "section-back-reference-item section-back-reference-markdown", children: [_jsx("a", { className: "section-back-reference-location", href: reference.url, children: reference.breadcrumbs.map((part, index) => (_jsxs("span", { className: "section-back-reference-breadcrumb", children: [index > 0 && _jsx("span", { "aria-hidden": "true", children: "\u203A" }), _jsx("span", { className: "section-back-reference-breadcrumb-label", children: part })] }, index))) }), _jsx("div", { className: "section-back-reference-paragraph", children: _jsx(DocumentNodes, { nodes: reference.paragraphTree.children }) })] }));
}
function SectionMenu({ heading, index, onCopySectionLink, onShowSectionOutput, section, sectionOutputEnabled, viewMarkdownUrl, }) {
    const [open, setOpen] = useState(false);
    const count = section.references.length;
    const panelId = `section-back-references-${index}`;
    const countLabel = count === 1 ? '1 reference' : `${count} references`;
    const stop = (callback) => (event) => {
        event.stopPropagation();
        callback();
    };
    return (_jsxs(_Fragment, { children: [createElement(heading.tagName, heading.properties, heading.children, _jsxs("button", { "aria-controls": panelId, "aria-expanded": open, "aria-label": `Section menu${count > 0 ? `, ${countLabel}` : ''}`, className: "section-back-reference-toggle", onClick: stop(() => setOpen((value) => !value)), type: "button", children: [_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", children: _jsx("path", { d: "M2.5 4h11M2.5 8h11M2.5 12h11" }) }), count > 0 && (_jsx("span", { className: "section-back-reference-count", children: count }))] }, "section-menu-toggle")), _jsxs("section", { "aria-label": `References to ${section.sectionId}`, className: "section-back-reference-panel", hidden: !open, id: panelId, children: [count > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "section-back-reference-header", children: "Referenced From" }), _jsx("div", { className: "section-back-reference-list", children: section.references.map((reference, referenceIndex) => reference.kind === 'markdown' ? (_jsx(MarkdownReference, { reference: reference }, `markdown-${reference.sectionId}-${referenceIndex}`)) : (_jsx(CodeReference, { reference: reference }, `code-${reference.path}-${reference.line}`))) })] })) : (_jsx("div", { className: "section-back-reference-empty", children: "No references to this section" })), _jsxs("div", { className: "section-back-reference-actions", children: [_jsx("button", { className: "section-back-reference-action", onClick: stop(() => onCopySectionLink?.(section.headingId)), type: "button", children: "Copy Link to the Section" }), index === 0 && viewMarkdownUrl && (_jsx("a", { className: "section-back-reference-action", href: viewMarkdownUrl, children: "View Markdown File" })), _jsx("button", { className: "section-back-reference-action", onClick: stop(() => copySectionId(section.sectionId, window.navigator.clipboard)), type: "button", children: "Copy Section ID" }), sectionOutputEnabled && (_jsxs("button", { className: "section-back-reference-action", onClick: stop(() => onShowSectionOutput?.(section.sectionId)), type: "button", children: ["Show ", _jsx("code", { children: "lat section" }), " Output"] }))] })] })] }));
}
function DocumentElement({ context, node, path, }) {
    const properties = elementProperties(node, path);
    const children = VOID_ELEMENTS.has(node.tagName)
        ? undefined
        : node.children.map((child, index) => documentNode(child, `${path}.${index}`, context));
    const fenceKind = richFenceKind(node);
    const element = createElement(node.tagName, properties, children);
    const content = node.tagName === 'pre' ? (_jsx(CodeBlock, { text: documentNodeText(node), children: element })) : (element);
    if (fenceKind) {
        const fence = (_jsx(MarkdownRichFence, { fallback: content, kind: fenceKind, source: node.children.map(documentNodeText).join('') }, path));
        const classes = [node, ...node.children].flatMap((child) => {
            if (child.type !== 'element')
                return [];
            const value = child.properties.className;
            return Array.isArray(value)
                ? value.map(String)
                : String(value ?? '').split(/\s+/);
        });
        const change = classes.includes('git-removed')
            ? 'removed'
            : classes.includes('git-added')
                ? 'added'
                : null;
        return change ? (_jsx("div", { className: `markdown-rich-fence-diff git-${change}`, children: fence })) : (fence);
    }
    const headingId = /^h[1-6]$/.test(node.tagName) && typeof node.properties.id === 'string'
        ? node.properties.id
        : null;
    const backReferences = headingId ? context?.sections.get(headingId) : null;
    if (!backReferences) {
        return content;
    }
    return (_jsx(SectionMenu, { heading: { children, properties, tagName: node.tagName }, index: backReferences.index, onCopySectionLink: context?.onCopySectionLink, onShowSectionOutput: context?.onShowSectionOutput, section: backReferences.section, sectionOutputEnabled: context?.sectionOutputEnabled ?? true, viewMarkdownUrl: context?.viewMarkdownUrl }, path));
}
function documentNode(node, path, context) {
    if (node.type === 'text')
        return node.value;
    return (_jsx(DocumentElement, { context: context, node: node, path: path }, path));
}
export function DocumentNodes({ nodes, }) {
    return _jsx(_Fragment, { children: nodes.map((node, index) => documentNode(node, String(index))) });
}
export function MarkdownContent({ backReferences = [], onClick, onCopySectionLink, onShowSectionOutput, sectionOutputEnabled = true, tree, viewMarkdownUrl, }) {
    const context = {
        sections: new Map(backReferences.map((section, index) => [
            section.headingId,
            { index, section },
        ])),
        sectionOutputEnabled,
        onCopySectionLink,
        onShowSectionOutput,
        viewMarkdownUrl,
    };
    return (_jsx("article", { className: "markdown", onClick: onClick, children: tree.children.map((node, index) => documentNode(node, String(index), context)) }));
}
