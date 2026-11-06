import { type MouseEvent } from 'react';
import type { ViewDocumentNode, ViewDocumentTree, ViewSectionBackReferences } from '../../src/view/protocol';
export declare function DocumentNodes({ nodes, }: {
    nodes: readonly ViewDocumentNode[];
}): import("react").JSX.Element;
export declare function MarkdownContent({ backReferences, onClick, onCopySectionLink, onShowSectionOutput, sectionOutputEnabled, tree, viewMarkdownUrl, }: {
    backReferences?: ViewSectionBackReferences[];
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onCopySectionLink?: (headingId: string) => void;
    onShowSectionOutput?: (sectionId: string) => void;
    sectionOutputEnabled?: boolean;
    tree: ViewDocumentTree;
    viewMarkdownUrl?: string;
}): import("react").JSX.Element;
