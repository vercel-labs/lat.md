import type { ViewGraph, ViewGraphNode } from '../../src/view/protocol';
export type GraphPosition = {
    x: number;
    y: number;
};
export declare function graphDisplayLabel(node: Pick<ViewGraphNode, 'breadcrumbs' | 'kind' | 'label' | 'sourcePath'>): string;
export declare function graphNodeSize(backlinks: number): number;
/** Place code around its strongest document neighbor without an animated layout. */
export declare function staticGraphPositions(graph: Pick<ViewGraph, 'edges' | 'nodes'>): Map<string, GraphPosition>;
/** Give semantic document matches and their attached code nodes a relevance score. */
export declare function graphSearchNodeScores(graph: Pick<ViewGraph, 'edges' | 'nodes'>, documentScores: ReadonlyMap<string, number>): Map<string, number>;
/** Stretch the current result scores across a legible node-size range. */
export declare function graphSearchNodeSizes(scores: ReadonlyMap<string, number>): Map<string, number>;
export declare function deterministicGraphPosition(id: string): GraphPosition;
export declare function validGraphPosition(position: GraphPosition | undefined): position is GraphPosition;
