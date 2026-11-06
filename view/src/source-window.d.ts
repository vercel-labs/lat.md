export declare const SOURCE_CONTEXT_BUFFER = 5;
export type SourceFocusRange = {
    startLine: number;
    endLine: number;
} | null;
export type SourceWindow = {
    startLine: number;
    endLine: number;
    hiddenAbove: number;
    hiddenBelow: number;
};
export type SourceWindowRow = {
    kind: 'context';
} | {
    kind: 'expand';
    count: number;
    direction: 'above' | 'below';
} | {
    kind: 'line';
    focused: boolean;
    lineNumber: number;
};
export declare function getSourceWindow(totalLines: number, focus: SourceFocusRange, expandedAbove?: boolean, expandedBelow?: boolean): SourceWindow;
/** Build the interleaved rows rendered inside the source code panel. */
export declare function getSourceWindowRows(totalLines: number, focus: SourceFocusRange, hasContext: boolean, expandedAbove?: boolean, expandedBelow?: boolean): SourceWindowRow[];
