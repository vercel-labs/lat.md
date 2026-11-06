import { INDEX_FILE } from '../search/db.js';
import { chmod, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLatServerApp } from '@lat.md/server';
import { createPreindexedViewSearch, } from './preindexed-search.js';
export const SERVER_VIEW_SCHEMA_VERSION = 1;
function searchRoute(basePath) {
    return `${basePath === '/' ? '' : basePath.slice(0, -1)}/api/search`;
}
function sendJson(res, status, value, headOnly) {
    const body = JSON.stringify(value);
    res.statusCode = status;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(headOnly ? undefined : body);
}
function localPath(path) {
    return resolve(typeof path === 'string' ? path : fileURLToPath(path));
}
async function readManifest(path) {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    if (manifest.version !== SERVER_VIEW_SCHEMA_VERSION ||
        typeof manifest.basePath !== 'string' ||
        !Array.isArray(manifest.sections)) {
        throw new Error(`Unsupported Lat server build manifest: ${path}`);
    }
    return manifest;
}
async function prepareServerView(options, manifestFile, indexFile) {
    const manifest = await readManifest(manifestFile);
    let search = options.search;
    let ownedSearch;
    let runtimeDir;
    if (!search) {
        if (basename(indexFile) !== INDEX_FILE) {
            throw new Error(`Server search index must be named ${INDEX_FILE}: ${indexFile}`);
        }
        const documentPaths = new Map();
        const sections = manifest.sections.map(({ documentPath, ...section }) => {
            documentPaths.set(section.id.toLowerCase(), documentPath);
            return { ...section, children: [] };
        });
        const openSearch = (cacheDir) => createPreindexedViewSearch(dirname(indexFile), cacheDir, sections, documentPaths, undefined, options.createSearchEngine);
        try {
            ownedSearch = await openSearch(dirname(indexFile));
        }
        catch (error) {
            const code = error.code;
            if (code !== 'EROFS' && code !== 'EACCES')
                throw error;
            // Serverless bundles are immutable; locks and database sidecars need writes.
            runtimeDir = await mkdtemp(join(tmpdir(), 'lat-server-search-'));
            try {
                await copyFile(indexFile, join(runtimeDir, INDEX_FILE));
                await chmod(join(runtimeDir, INDEX_FILE), 0o600);
                ownedSearch = await openSearch(runtimeDir);
            }
            catch (copyError) {
                await rm(runtimeDir, { recursive: true, force: true });
                throw copyError;
            }
        }
        search = ownedSearch;
    }
    return {
        manifest,
        search,
        close: async () => {
            try {
                await ownedSearch?.close();
            }
            finally {
                if (runtimeDir)
                    await rm(runtimeDir, { recursive: true, force: true });
            }
        },
    };
}
/**
 * Create the portable Express application emitted by `lat ui build server`.
 * Static assets are also mounted for ordinary Node hosts; platforms with a CDN
 * can serve `public/` directly and forward only the search route to this app.
 */
export function createServerViewApp(options) {
    const manifestFile = localPath(options.manifestFile);
    const publicDir = resolve(dirname(manifestFile), '..', 'public');
    const prepared = prepareServerView(options, manifestFile, localPath(options.indexFile));
    // Preparation starts before the first request; requests still receive its error.
    void prepared.catch(() => { });
    const app = createLatServerApp({
        publicDir,
        async handle(req, res, next) {
            const { manifest, search } = await prepared;
            const method = req.method ?? 'GET';
            const headOnly = method === 'HEAD';
            if (method !== 'GET' && !headOnly)
                return next();
            const url = new URL(req.url ?? '/', 'http://lat.local');
            if (url.pathname !== searchRoute(manifest.basePath))
                return next();
            try {
                const query = (url.searchParams.get('query') ?? '').trim();
                if (query.length > 500) {
                    sendJson(res, 400, { error: 'Search query is too long' }, headOnly);
                    return;
                }
                sendJson(res, 200, await search(query), headOnly);
            }
            catch (error) {
                next(error);
            }
        },
    }, options.app);
    return {
        app,
        close: async () => {
            await (await prepared).close();
        },
    };
}
