export type GraphViewport = {
    width: number;
    height: number;
    activeWidth: number;
};
type CameraState = {
    x: number;
    y: number;
    angle: number;
    ratio: number;
};
/** Preserve the view in the interaction pane when the drawing surface changes. */
export declare function graphViewportCamera(state: CameraState, from: GraphViewport, to: GraphViewport, graphDimensions: {
    width: number;
    height: number;
}): CameraState;
export declare function graphFitCamera(viewport: GraphViewport, graphDimensions: {
    width: number;
    height: number;
}): CameraState;
export {};
