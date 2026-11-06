import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { fetchViewJson } from './data-source';
import { MarkdownContent } from './MarkdownContent';
import { sectionOutputRequestUrl } from './section-back-references';
export const DEFAULT_SECTION_OUTPUT_PRESENTATION = 'formatted';
export function SectionOutputDialog({ onClose, sectionId, }) {
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [presentation, setPresentation] = useState(DEFAULT_SECTION_OUTPUT_PRESENTATION);
    const closeButton = useRef(null);
    useEffect(() => {
        if (!sectionId)
            return;
        const controller = new AbortController();
        setResult(null);
        setError('');
        setPresentation(DEFAULT_SECTION_OUTPUT_PRESENTATION);
        void fetchViewJson(sectionOutputRequestUrl(sectionId), controller.signal)
            .then(setResult)
            .catch((reason) => {
            if (!controller.signal.aborted)
                setError(reason.message);
        });
        return () => controller.abort();
    }, [sectionId]);
    useEffect(() => {
        if (!sectionId)
            return;
        closeButton.current?.focus();
        const closeForEscape = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', closeForEscape);
        return () => window.removeEventListener('keydown', closeForEscape);
    }, [onClose, sectionId]);
    if (!sectionId)
        return null;
    return (_jsx("div", { className: "section-output-backdrop", onMouseDown: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, role: "presentation", children: _jsxs("section", { "aria-labelledby": "section-output-title", "aria-modal": "true", className: "section-output-dialog", role: "dialog", children: [_jsxs("header", { className: "section-output-header", children: [_jsxs("div", { className: "section-output-heading", children: [_jsxs("div", { className: "section-output-title-line", children: [_jsxs("h2", { id: "section-output-title", children: [_jsx("code", { children: "lat section" }), " Output"] }), _jsx("div", { "aria-label": "Section output presentation", className: "section-output-presentation", role: "group", children: ['raw', 'formatted'].map((value) => (_jsx("button", { "aria-pressed": presentation === value, onClick: () => setPresentation(value), type: "button", children: value === 'raw' ? 'Raw' : 'Formatted' }, value))) })] }), _jsx("code", { className: "section-output-id", children: sectionId })] }), _jsx("button", { "aria-label": "Close section output", className: "section-output-close", onClick: onClose, ref: closeButton, type: "button", children: "\u00D7" })] }), error ? (_jsx("div", { className: "section-output-state error", role: "alert", children: error })) : result ? (presentation === 'formatted' ? (_jsx("div", { className: "section-output-formatted", "data-error": result.isError || undefined, children: _jsx(MarkdownContent, { tree: result.tree }) })) : (_jsx("pre", { className: "section-output-raw", "data-error": result.isError || undefined, children: result.output }))) : (_jsx("div", { className: "section-output-state", children: "Running lat section\u2026" }))] }) }));
}
