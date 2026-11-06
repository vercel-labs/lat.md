import type { CmdContext, CmdResult } from '@lat.md/core/context';
import { type ViewServer, type ViewServerOptions } from '../view/server.js';
type UiCommandOptions = ViewServerOptions & {
    openBrowser?: (url: string) => Promise<void>;
    onStarted?: (server: ViewServer) => void;
};
/** Launch the platform browser without passing the URL through a shell. */
export declare function openBrowser(url: string): Promise<void>;
/** Start `lat ui`, report its URL, and launch the default browser. */
export declare function uiCommand(ctx: CmdContext, options?: UiCommandOptions): Promise<CmdResult>;
export {};
