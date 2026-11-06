import { type LatServerApp } from '@lat.md/server';
import type { Express } from 'express';
import type { Section } from '@lat.md/core/lattice-model';
import type { CreateSearchEngine } from '../search/embedder.js';
import type { ViewSearchResponse } from './protocol.js';
export declare const SERVER_VIEW_SCHEMA_VERSION = 1;
export type ServerViewSection = Omit<Section, 'children'> & {
    documentPath: string;
};
export type ServerViewManifest = {
    version: number;
    basePath: string;
    sections: ServerViewSection[];
};
export type ServerViewAppOptions = {
    app: Express;
    manifestFile: string | URL;
    indexFile: string | URL;
    createSearchEngine?: CreateSearchEngine;
    search?: (query: string) => Promise<ViewSearchResponse>;
};
export type ServerViewApp = {
    app: LatServerApp;
    close: () => Promise<void>;
};
/**
 * Create the portable Express application emitted by `lat ui build server`.
 * Static assets are also mounted for ordinary Node hosts; platforms with a CDN
 * can serve `public/` directly and forward only the search route to this app.
 */
export declare function createServerViewApp(options: ServerViewAppOptions): ServerViewApp;
