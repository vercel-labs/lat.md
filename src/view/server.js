import { trustedLiveRequest, RESOURCE_CONTENT_SECURITY_POLICY, } from './request-security.js';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLatServerApp, listenLatServer, } from '@lat.md/server';
import { plainStyler } from '@lat.md/core/context';
import { sectionCommand } from '@lat.md/core/cli/section';
import { DEFAULT_VIEW_LOGO_TEXT, } from './protocol.js';
import { ViewDocumentConflictError } from './document-edit.js';
import { ViewExternalNotFoundError, ViewDocumentNotFoundError, ViewSourceNotFoundError, } from './repository.js';
import { createViewSearch } from './search.js';
import { createViewStore } from './store.js';
import { rewriteClientAssetUrls } from './client-shell.js';
import { documentResourcePath, documentPath, rawDocumentPath, validateDocumentRoutes, } from './document-route.js';
const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_VIEW_PORT = 4242;
const MAX_DOCUMENT_EDIT_BODY_BYTES = 16 * 1024 * 1024;
const MAX_DOCUMENT_CONTENT_LENGTH = 8 * 1024 * 1024;
const defaultClientDir = fileURLToPath(new URL('./client/', import.meta.url));
function send(res, status, contentType, body, headOnly = false) {
    res.statusCode = status;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(headOnly ? undefined : body);
}
function sendJson(res, status, value, headOnly) {
    res.setHeader('Cache-Control', 'no-store');
    send(res, status, 'application/json; charset=utf-8', JSON.stringify(value), headOnly);
}
async function readJsonBody(req) {
    const chunks = [];
    let size = 0;
    for await (const value of req) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        size += chunk.byteLength;
        if (size > MAX_DOCUMENT_EDIT_BODY_BYTES) {
            throw new RangeError('Document edit is too large');
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    catch {
        throw new SyntaxError('Document edit must be valid JSON');
    }
}
function contentType(path) {
    switch (extname(path)) {
        case '.css':
            return 'text/css; charset=utf-8';
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
            return 'text/javascript; charset=utf-8';
        case '.json':
            return 'application/json; charset=utf-8';
        case '.gif':
            return 'image/gif';
        case '.jpeg':
        case '.jpg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.svg':
            return 'image/svg+xml';
        case '.webp':
            return 'image/webp';
        case '.woff2':
            return 'font/woff2';
        default:
            return 'application/octet-stream';
    }
}
function clientPath(clientDir, requestPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(requestPath);
    }
    catch {
        return null;
    }
    const candidate = resolve(clientDir, `.${decoded}`);
    const rel = relative(clientDir, candidate);
    if (rel === '..' || rel.startsWith(`..${sep}`))
        return null;
    return candidate;
}
async function sendClientFile(res, path, headOnly, immutable = false) {
    try {
        const body = await readFile(path);
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
        send(res, 200, contentType(path), body, headOnly);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
        send(res, 404, 'text/plain; charset=utf-8', 'Not found', headOnly);
    }
}
async function sendClientShell(res, path, headOnly, entry) {
    try {
        const html = rewriteClientAssetUrls(await readFile(path, 'utf8'), '/');
        const config = `<meta name="lat-live-entry" content="${encodeURIComponent(entry)}">`;
        const body = html.includes('</head>')
            ? html.replace('</head>', `${config}</head>`)
            : `${config}${html}`;
        res.setHeader('Cache-Control', 'no-cache');
        send(res, 200, 'text/html; charset=utf-8', body, headOnly);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
        send(res, 404, 'text/plain; charset=utf-8', 'Not found', headOnly);
    }
}
/** Create the portable Express application used by live Lat UI servers. */
export async function createViewApp(ctx, options = {}) {
    const host = options.host ?? DEFAULT_HOST;
    const clientDir = options.clientDir ?? defaultClientDir;
    const logoText = options.logoText ?? DEFAULT_VIEW_LOGO_TEXT;
    const store = await createViewStore(ctx.latDir, ctx.projectRoot, {
        git: options.git,
        gitPollMs: options.gitPollMs,
        watch: options.watch,
        externalCa: options.externalCa,
    });
    try {
        validateDocumentRoutes(store.getIndex().files);
    }
    catch (error) {
        await store.close();
        throw error;
    }
    const search = options.search ??
        createViewSearch(ctx.latDir, undefined, () => store.markdownGeneration);
    const eventClients = new Set();
    const instanceId = randomUUID();
    const broadcastChange = (change) => {
        const message = `event: change\ndata: ${JSON.stringify({ ...change, instanceId })}\n\n`;
        for (const client of eventClients)
            client.write(message);
    };
    const unsubscribeStore = store.subscribe(broadcastChange);
    const heartbeat = setInterval(() => {
        for (const client of eventClients)
            client.write(': heartbeat\n\n');
    }, 15_000);
    heartbeat.unref();
    const handleRequest = (req, res) => {
        void (async () => {
            if (!trustedLiveRequest(req, host)) {
                send(res, 403, 'text/plain; charset=utf-8', 'Untrusted request origin or host');
                return;
            }
            const method = req.method ?? 'GET';
            const headOnly = method === 'HEAD';
            const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
            const documentEdit = method === 'PATCH' && url.pathname === '/api/document';
            if (method !== 'GET' && !headOnly && !documentEdit) {
                res.setHeader('Allow', 'GET, HEAD');
                send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
                return;
            }
            if (url.pathname === '/') {
                const entry = store.getIndex().entry;
                if (!entry) {
                    send(res, 404, 'text/plain; charset=utf-8', 'No Markdown files found');
                    return;
                }
                await sendClientShell(res, join(clientDir, 'index.html'), headOnly, entry);
                return;
            }
            const index = store.getIndex();
            const routePath = url.pathname.replace(/\/$/, '');
            const markdownPath = documentPath(routePath);
            if (markdownPath === index.entry) {
                res.statusCode = 308;
                res.setHeader('Location', `/${url.search}`);
                res.end();
                return;
            }
            if (url.pathname === '/api/index') {
                sendJson(res, 200, { ...store.getIndex(), logoText }, headOnly);
                return;
            }
            if (url.pathname === '/api/graph') {
                sendJson(res, 200, store.getGraph(), headOnly);
                return;
            }
            if (url.pathname === '/api/events') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders();
                if (headOnly) {
                    res.end();
                    return;
                }
                eventClients.add(res);
                res.write(`retry: 1000\nevent: ready\ndata: ${JSON.stringify({ instanceId, generation: store.snapshot.generation, markdownGeneration: store.markdownGeneration })}\n\n`);
                req.once('close', () => eventClients.delete(res));
                return;
            }
            if (url.pathname === '/api/document') {
                const path = url.searchParams.get('path') ?? '';
                if (documentEdit) {
                    let body;
                    try {
                        body = await readJsonBody(req);
                    }
                    catch (error) {
                        sendJson(res, error instanceof RangeError ? 413 : 400, { error: error.message }, false);
                        return;
                    }
                    if (!body ||
                        typeof body !== 'object' ||
                        typeof body.baseContent !==
                            'string' ||
                        typeof body.content !==
                            'string') {
                        sendJson(res, 400, {
                            error: 'Document edit content is required',
                        }, false);
                        return;
                    }
                    const edit = body;
                    if (edit.baseContent.length > MAX_DOCUMENT_CONTENT_LENGTH ||
                        edit.content.length > MAX_DOCUMENT_CONTENT_LENGTH) {
                        sendJson(res, 413, { error: 'Document edit is too large' }, false);
                        return;
                    }
                    try {
                        sendJson(res, 200, await store.editDocument(path, edit.baseContent, edit.content), false);
                    }
                    catch (error) {
                        if (error instanceof ViewDocumentConflictError) {
                            sendJson(res, 409, { error: error.message }, false);
                            return;
                        }
                        if (!(error instanceof ViewDocumentNotFoundError))
                            throw error;
                        sendJson(res, 404, { error: error.message }, false);
                    }
                    return;
                }
                try {
                    sendJson(res, 200, await store.getDocument(path), headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewDocumentNotFoundError))
                        throw error;
                    sendJson(res, 404, { error: error.message }, headOnly);
                }
                return;
            }
            if (url.pathname === '/api/document-source') {
                const path = url.searchParams.get('path') ?? '';
                try {
                    sendJson(res, 200, await store.getDocumentSource(path), headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewDocumentNotFoundError))
                        throw error;
                    sendJson(res, 404, { error: error.message }, headOnly);
                }
                return;
            }
            if (url.pathname === '/api/search') {
                const query = (url.searchParams.get('query') ?? '').trim();
                if (query.length > 500) {
                    sendJson(res, 400, { error: 'Search query is too long' }, headOnly);
                    return;
                }
                sendJson(res, 200, await search(query), headOnly);
                return;
            }
            if (url.pathname === '/api/section') {
                const query = (url.searchParams.get('query') ?? '').trim();
                if (!query) {
                    sendJson(res, 400, { error: 'Section ID is required' }, headOnly);
                    return;
                }
                if (query.length > 1_000) {
                    sendJson(res, 400, { error: 'Section ID is too long' }, headOnly);
                    return;
                }
                const result = await sectionCommand({
                    latDir: ctx.latDir,
                    projectRoot: ctx.projectRoot,
                    styler: plainStyler,
                    mode: 'cli',
                }, query);
                const tree = await store.renderSectionOutput(result.output, query);
                sendJson(res, 200, {
                    output: result.output,
                    tree,
                    isError: result.isError === true,
                }, headOnly);
                return;
            }
            if (url.pathname === '/api/source') {
                const path = url.searchParams.get('path') ?? '';
                const symbol = url.searchParams.get('symbol') ?? '';
                const from = url.searchParams.get('from') ?? '';
                const parsedLine = Number(url.searchParams.get('line'));
                const parsedFocusLine = Number(url.searchParams.get('at'));
                const focusLine = Number.isInteger(parsedFocusLine) && parsedFocusLine > 0
                    ? parsedFocusLine
                    : 0;
                const origin = from && Number.isInteger(parsedLine) && parsedLine > 0
                    ? { sectionId: from, line: parsedLine }
                    : undefined;
                try {
                    sendJson(res, 200, await store.getSource(path, symbol, origin, focusLine), headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewSourceNotFoundError))
                        throw error;
                    sendJson(res, 404, { error: error.message }, headOnly);
                }
                return;
            }
            if (url.pathname === '/api/external') {
                const target = url.searchParams.get('target') ?? '';
                try {
                    sendJson(res, 200, await store.getExternal(target), headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewExternalNotFoundError))
                        throw error;
                    sendJson(res, 404, { error: error.message }, headOnly);
                }
                return;
            }
            if (url.pathname.startsWith('/assets/')) {
                const path = clientPath(clientDir, url.pathname);
                if (!path) {
                    send(res, 404, 'text/plain; charset=utf-8', 'Not found', headOnly);
                    return;
                }
                await sendClientFile(res, path, headOnly, true);
                return;
            }
            const rawMarkdownPath = rawDocumentPath(url.pathname);
            if (rawMarkdownPath) {
                try {
                    const source = await store.getDocumentSource(rawMarkdownPath);
                    res.setHeader('Cache-Control', 'no-cache');
                    send(res, 200, 'text/markdown; charset=utf-8', source.content, headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewDocumentNotFoundError))
                        throw error;
                    send(res, 404, 'text/plain; charset=utf-8', error.message, headOnly);
                }
                return;
            }
            const resourcePath = documentResourcePath(url.pathname);
            if (resourcePath) {
                try {
                    const body = await store.getDocumentResource(resourcePath);
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Content-Security-Policy', RESOURCE_CONTENT_SECURITY_POLICY);
                    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
                    if (/\.(?:html?|xhtml|xml|[cm]?js)$/i.test(resourcePath)) {
                        res.setHeader('Content-Disposition', 'attachment');
                    }
                    send(res, 200, contentType(resourcePath), body, headOnly);
                }
                catch (error) {
                    if (!(error instanceof ViewDocumentNotFoundError))
                        throw error;
                    send(res, 404, 'text/plain; charset=utf-8', error.message, headOnly);
                }
                return;
            }
            if (url.pathname === '/search' ||
                url.pathname === '/graph' ||
                (markdownPath !== null &&
                    (markdownPath.startsWith('@/') ||
                        index.files.includes(markdownPath))) ||
                url.pathname.startsWith('/code/') ||
                url.pathname.startsWith('/external/')) {
                await sendClientShell(res, join(clientDir, 'index.html'), headOnly, index.entry);
                return;
            }
            send(res, 404, 'text/plain; charset=utf-8', 'Not found', headOnly);
        })().catch((error) => {
            if (res.headersSent) {
                res.destroy(error);
                return;
            }
            sendJson(res, 500, { error: error.message }, false);
        });
    };
    const app = createLatServerApp({ handle: handleRequest });
    return {
        app,
        store,
        close: async () => {
            clearInterval(heartbeat);
            unsubscribeStore();
            for (const client of eventClients)
                client.end();
            eventClients.clear();
            await store.close();
        },
    };
}
/** Start the loopback server used by `lat ui`. */
export async function startViewServer(ctx, options = {}) {
    const host = options.host ?? DEFAULT_HOST;
    const view = await createViewApp(ctx, options);
    let running;
    try {
        const requestedPort = options.port;
        running = await listenLatServer(view.app, {
            host,
            port: requestedPort ?? DEFAULT_VIEW_PORT,
            findAvailablePort: requestedPort === undefined,
        });
    }
    catch (error) {
        await view.close();
        throw error;
    }
    return {
        server: running.server,
        store: view.store,
        url: running.url,
        close: async () => {
            await Promise.all([running.close(), view.close()]);
        },
    };
}
