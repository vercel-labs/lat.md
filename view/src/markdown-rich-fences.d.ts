import type { GeoJSON } from 'geojson';
export type ThreeModules = {
    OrbitControls: typeof import('three/addons/controls/OrbitControls.js').OrbitControls;
    STLLoader: typeof import('three/addons/loaders/STLLoader.js').STLLoader;
    three: typeof import('three');
};
export type MapLibreModule = typeof import('maplibre-gl');
export type MapLibreMap = import('maplibre-gl').Map;
export type TopoJsonModule = typeof import('topojson-client');
export type GeoJsonBounds = [
    southwest: [longitude: number, latitude: number],
    northeast: [longitude: number, latitude: number]
];
export declare const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Cache concurrent lazy loads while allowing a rejected load to be retried. */
export declare function recoverableLazyImport<T>(load: () => Promise<T>): () => Promise<T>;
export declare const getMapLibre: () => Promise<typeof import("maplibre-gl")>;
export declare const getTopoJson: () => Promise<typeof import("topojson-client")>;
export declare const getMermaid: () => Promise<import("mermaid").Mermaid>;
export declare const getThreeModules: () => Promise<ThreeModules>;
export declare function nextMermaidDiagramId(): string;
export declare function richFenceErrorMessage(reason: unknown): string;
export declare function parseGeoJson(source: string): GeoJSON;
export declare function parseTopoJson(source: string, topojson: TopoJsonModule): GeoJSON;
/** Return the geographic bounds of all finite coordinates in GeoJSON. */
export declare function geoJsonBounds(data: GeoJSON): GeoJsonBounds | null;
export declare function fallbackMapStyle(): import('maplibre-gl').StyleSpecification;
export declare function addMapGeometry(map: MapLibreMap, data: GeoJSON, color: string): void;
export declare function frameMap(map: MapLibreMap, bounds: GeoJsonBounds | null): void;
export declare function parseStl(source: string, STLLoader: ThreeModules['STLLoader']): import('three').BufferGeometry;
