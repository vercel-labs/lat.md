import { type ReactNode } from 'react';
export type MarkdownRichFenceKind = 'geojson' | 'mermaid' | 'stl' | 'topojson';
type RichFenceProps = {
    fallback: ReactNode;
    kind: MarkdownRichFenceKind;
    source: string;
};
type SvgNode = {
    type: 'text';
    value: string;
} | {
    type: 'element';
    tagName: string;
    properties: Record<string, unknown>;
    children: SvgNode[];
};
export declare function parseMermaidSvg(source: string): SvgNode;
/** Render a rich Markdown fence as a React-owned browser component. */
export declare function MarkdownRichFence(props: RichFenceProps): import("react").JSX.Element;
export {};
