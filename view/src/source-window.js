export const SOURCE_CONTEXT_BUFFER = 5;
export function getSourceWindow(totalLines, focus, expandedAbove = false, expandedBelow = false) {
    if (!focus || totalLines < 1) {
        return {
            startLine: totalLines > 0 ? 1 : 0,
            endLine: totalLines,
            hiddenAbove: 0,
            hiddenBelow: 0,
        };
    }
    const focusStart = Math.max(1, Math.min(totalLines, focus.startLine));
    const focusEnd = Math.max(focusStart, Math.min(totalLines, focus.endLine));
    const startLine = expandedAbove
        ? 1
        : Math.max(1, focusStart - SOURCE_CONTEXT_BUFFER);
    const endLine = expandedBelow
        ? totalLines
        : Math.min(totalLines, focusEnd + SOURCE_CONTEXT_BUFFER);
    return {
        startLine,
        endLine,
        hiddenAbove: startLine - 1,
        hiddenBelow: totalLines - endLine,
    };
}
/** Build the interleaved rows rendered inside the source code panel. */
export function getSourceWindowRows(totalLines, focus, hasContext, expandedAbove = false, expandedBelow = false) {
    const window = getSourceWindow(totalLines, focus, expandedAbove, expandedBelow);
    const rows = [];
    if (!focus && hasContext)
        rows.push({ kind: 'context' });
    if (window.hiddenAbove > 0) {
        rows.push({
            kind: 'expand',
            count: window.hiddenAbove,
            direction: 'above',
        });
    }
    for (let lineNumber = window.startLine; lineNumber <= window.endLine; lineNumber++) {
        if (hasContext && lineNumber === focus?.startLine) {
            rows.push({ kind: 'context' });
        }
        rows.push({
            kind: 'line',
            focused: Boolean(focus && lineNumber >= focus.startLine && lineNumber <= focus.endLine),
            lineNumber,
        });
    }
    if (window.hiddenBelow > 0) {
        rows.push({
            kind: 'expand',
            count: window.hiddenBelow,
            direction: 'below',
        });
    }
    return rows;
}
