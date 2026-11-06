import { type ReactNode } from 'react';
import type { ViewGraph, ViewGraphNode } from '../../src/view/protocol';
/** Warm the immutable graph projection so switching views does not wait on I/O. */
export declare function preloadViewGraph(minimumGeneration?: number, instanceId?: string): Promise<ViewGraph>;
export default function GraphView({ generation, gitEnabled, header, instanceId, markdownGeneration, onNavigate, onShowSectionOutput, searchEnabled, selectedNodeId, target, }: {
    generation: number;
    gitEnabled: boolean;
    header: (selectedNode: ViewGraphNode | null, selectedTarget: string) => ReactNode;
    instanceId: string;
    markdownGeneration: number;
    onNavigate: (url: URL) => void;
    onShowSectionOutput?: (sectionId: string) => void;
    searchEnabled: boolean;
    selectedNodeId: string;
    target: string;
}): import("react").JSX.Element;
