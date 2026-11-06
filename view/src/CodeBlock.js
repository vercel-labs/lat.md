import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
/** Keep clipboard controls outside the code and its horizontal scroll area. */
export function CodeBlock({ children, text, }) {
    const [result, setResult] = useState(null);
    const currentResult = result?.text === text ? result : null;
    useEffect(() => {
        if (!result)
            return;
        const timeout = window.setTimeout(() => setResult(null), 2500);
        return () => window.clearTimeout(timeout);
    }, [result]);
    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setResult({ text, copied: true });
        }
        catch {
            setResult({ text, copied: false });
        }
    }
    const label = currentResult
        ? currentResult.copied
            ? 'Copied!'
            : 'Copy failed. Try again.'
        : 'Copy Code';
    return (_jsxs("div", { className: "code-block", children: [children, _jsxs("button", { "aria-label": label, className: "code-block-copy", onClick: (event) => {
                    event.stopPropagation();
                    void copy();
                }, title: label, type: "button", children: [_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", children: currentResult?.copied ? (_jsx("path", { d: "m3 8 3 3 7-7" })) : (_jsxs(_Fragment, { children: [_jsx("rect", { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1.5" }), _jsx("path", { d: "M10.5 3.5v-1h-8v8h1" })] })) }), _jsx("span", { children: currentResult
                            ? currentResult.copied
                                ? 'Copied!'
                                : 'Retry Copy'
                            : 'Copy' })] }), _jsx("span", { className: "code-block-status", role: "status", children: currentResult ? label : '' })] }));
}
