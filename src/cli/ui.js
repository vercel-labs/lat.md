import { spawn } from 'node:child_process';
import { startViewServer, } from '../view/server.js';
/** Launch the platform browser without passing the URL through a shell. */
export function openBrowser(url) {
    const command = process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : process.platform === 'win32'
            ? { file: 'explorer.exe', args: [url] }
            : { file: 'xdg-open', args: [url] };
    return new Promise((resolve, reject) => {
        const child = spawn(command.file, command.args, {
            detached: true,
            stdio: 'ignore',
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
    });
}
/** Start `lat ui`, report its URL, and launch the default browser. */
export async function uiCommand(ctx, options = {}) {
    let server;
    try {
        server = await startViewServer(ctx, options);
    }
    catch (error) {
        if (options.port !== undefined &&
            error.code === 'EADDRINUSE') {
            return {
                isError: true,
                output: `Port ${options.port} is already in use. Choose another with --port <number>.`,
            };
        }
        throw error;
    }
    options.onStarted?.(server);
    const lines = [
        `Viewing lat.md at ${server.url}`,
        'Note: use `lat ui build static` or `lat ui build server` to build a deployable UI',
    ];
    try {
        await (options.openBrowser ?? openBrowser)(server.url);
    }
    catch (error) {
        lines.push(`Could not open the browser: ${error.message}`);
    }
    return { output: lines.join('\n') };
}
