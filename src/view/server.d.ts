import { type Server } from 'node:http';
import { type LatServerApp } from '@lat.md/server';
import { type CmdContext } from '@lat.md/core/context';
import { type ViewSearch } from './search.js';
import { type ViewStore } from './store.js';
export declare const DEFAULT_VIEW_PORT = 4242;
export type ViewServer = {
    server: Server;
    store: ViewStore;
    url: string;
    close: () => Promise<void>;
};
export type ViewApp = {
    app: LatServerApp;
    store: ViewStore;
    close: () => Promise<void>;
};
export type ViewServerOptions = {
    clientDir?: string;
    git?: boolean;
    gitPollMs?: number;
    host?: string;
    logoText?: string;
    port?: number;
    search?: ViewSearch;
    watch?: boolean;
    externalCa?: string | Buffer;
};
/** Create the portable Express application used by live Lat UI servers. */
export declare function createViewApp(ctx: CmdContext, options?: ViewServerOptions): Promise<ViewApp>;
/** Start the loopback server used by `lat ui`. */
export declare function startViewServer(ctx: CmdContext, options?: ViewServerOptions): Promise<ViewServer>;
