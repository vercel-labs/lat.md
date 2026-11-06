import { NodeCircleProgram } from 'sigma/rendering';
/** Keep overlapping circles distinct without changing Sigma's geometry or picking. */
export declare class GraphNodeProgram<N extends Record<string, unknown>, E extends Record<string, unknown>> extends NodeCircleProgram<N, E> {
    protected fillOpacity(): number;
    getDefinition(): {
        VERTICES: number;
        VERTEX_SHADER_SOURCE: string;
        METHOD: 4;
        UNIFORMS: readonly ["u_sizeRatio", "u_correctionRatio", "u_matrix"];
        ATTRIBUTES: ({
            name: string;
            size: number;
            type: 5126;
            normalized?: undefined;
        } | {
            name: string;
            size: number;
            type: 5121;
            normalized: boolean;
        })[];
        CONSTANT_ATTRIBUTES: {
            name: string;
            size: number;
            type: 5126;
        }[];
        CONSTANT_DATA: number[][];
        FRAGMENT_SHADER_SOURCE: string;
    };
}
/** Stronger fill preserves the selected node's hue in either theme. */
export declare class GraphSelectedNodeProgram<N extends Record<string, unknown>, E extends Record<string, unknown>> extends GraphNodeProgram<N, E> {
    protected fillOpacity(): number;
}
