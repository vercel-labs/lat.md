import { viewStaticSourceKey, viewStaticDocumentRequest, VIEW_STATIC_BOOTSTRAP_ID, } from '../../src/view/static-protocol';
import { staticViewBasePath, staticViewSearchApi } from './static-mode';
let manifestRequest = null;
let bootstrap;
const staticFileRequests = new Map();
export const VIEW_REQUEST_TIMEOUT_MS = 15_000;
export class ViewRequestTimeoutError extends Error {
    name = 'TimeoutError';
}
export class ViewRequestConnectionError extends Error {
    name = 'NetworkError';
}
function isTransientRequestError(reason) {
    return (reason instanceof TypeError ||
        (typeof reason === 'object' &&
            reason !== null &&
            'name' in reason &&
            reason.name === 'AbortError'));
}
async function fetchJsonFile(url, signal, init = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (signal?.aborted)
        controller.abort();
    else
        signal?.addEventListener('abort', abort, { once: true });
    const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, VIEW_REQUEST_TIMEOUT_MS);
    const method = (init.method ?? 'GET').toUpperCase();
    const attempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
    try {
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const response = await fetch(url, {
                    ...init,
                    signal: controller.signal,
                });
                const value = (await response.json());
                if (!response.ok) {
                    throw new Error(value && typeof value === 'object' && 'error' in value
                        ? value.error
                        : 'Request failed');
                }
                return value;
            }
            catch (reason) {
                if (timedOut) {
                    throw new ViewRequestTimeoutError('The server did not respond in time. Try again.');
                }
                if (controller.signal.aborted)
                    throw reason;
                if (!isTransientRequestError(reason))
                    throw reason;
                if (attempt + 1 < attempts)
                    continue;
                throw new ViewRequestConnectionError('The server connection was interrupted. Try again.');
            }
        }
        throw new ViewRequestConnectionError('The server connection was interrupted. Try again.');
    }
    finally {
        globalThis.clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
    }
}
export function fetchViewDocumentSource(path, signal) {
    if (staticViewBasePath()) {
        return Promise.reject(new Error('Static views cannot edit documents'));
    }
    return fetchJsonFile(`/api/document-source?path=${encodeURIComponent(path)}`, signal);
}
export function updateViewDocument(path, edit, signal) {
    if (staticViewBasePath()) {
        return Promise.reject(new Error('Static views cannot edit documents'));
    }
    return fetchJsonFile(`/api/document?path=${encodeURIComponent(path)}`, signal, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
    });
}
function staticDataUrl(path) {
    const basePath = staticViewBasePath();
    if (!basePath)
        return path;
    return new URL(`${basePath}${path}`, window.location.origin).toString();
}
function fetchStaticFile(path) {
    const url = staticDataUrl(path);
    const existing = staticFileRequests.get(url);
    if (existing)
        return existing;
    const request = fetchJsonFile(url).catch((error) => {
        staticFileRequests.delete(url);
        throw error;
    });
    staticFileRequests.set(url, request);
    return request;
}
function staticBootstrap() {
    if (bootstrap !== undefined)
        return bootstrap;
    const content = document.getElementById(VIEW_STATIC_BOOTSTRAP_ID)?.textContent;
    if (!content)
        return (bootstrap = null);
    try {
        const value = JSON.parse(content);
        if (!value ||
            typeof value !== 'object' ||
            !value.manifest ||
            typeof value.responses !== 'object') {
            return (bootstrap = null);
        }
        return (bootstrap = value);
    }
    catch {
        return (bootstrap = null);
    }
}
function staticManifest() {
    const initial = staticBootstrap()?.manifest;
    if (initial)
        return Promise.resolve(initial);
    if (!manifestRequest) {
        manifestRequest = fetchStaticFile('data/manifest.json').catch((error) => {
            manifestRequest = null;
            throw error;
        });
    }
    return manifestRequest;
}
/** Warm a content-addressed document when a static navigation is imminent. */
export async function prefetchViewDocument(path) {
    if (!staticViewBasePath())
        return;
    if (staticBootstrap()?.responses[viewStaticDocumentRequest(path)])
        return;
    const manifest = await staticManifest();
    const dataPath = manifest.documents[path];
    if (dataPath)
        await fetchStaticFile(dataPath);
}
function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
/** Resolve either a live API request or its immutable static-build equivalent. */
export async function fetchViewJson(requestUrl, signal) {
    if (!staticViewBasePath()) {
        return fetchJsonFile(requestUrl, signal);
    }
    const url = new URL(requestUrl, 'http://lat.local');
    if (url.pathname === '/api/search') {
        const endpoint = staticViewSearchApi();
        if (!endpoint)
            throw new Error('Static views do not include search');
        const target = new URL(endpoint, window.location.origin);
        target.search = url.search;
        return fetchJsonFile(target.toString(), signal);
    }
    const manifest = await staticManifest();
    if (url.pathname === '/api/index')
        return manifest.index;
    const initial = staticBootstrap()?.responses[requestUrl];
    if (initial)
        return initial;
    let dataPath;
    if (url.pathname === '/api/graph') {
        dataPath = manifest.graph;
    }
    else if (url.pathname === '/api/document') {
        dataPath = manifest.documents[url.searchParams.get('path') ?? ''];
    }
    else if (url.pathname === '/api/source') {
        const request = {
            path: url.searchParams.get('path') ?? '',
            symbol: url.searchParams.get('symbol') ?? '',
            from: url.searchParams.get('from') ?? '',
            line: positiveInteger(url.searchParams.get('line')),
            at: positiveInteger(url.searchParams.get('at')),
        };
        const entry = manifest.sources[viewStaticSourceKey(request)];
        if (!entry)
            throw new Error('Static view data not found');
        const [file, view] = await Promise.all([
            fetchStaticFile(entry.file),
            fetchStaticFile(entry.view),
        ]);
        return { ...file, ...view };
    }
    else if (url.pathname === '/api/external') {
        const entry = manifest.externals[url.searchParams.get('target') ?? ''];
        if (!entry)
            throw new Error('Static external data not found');
        if (entry.kind === 'markdown') {
            const document = await fetchStaticFile(entry.document);
            return document;
        }
        const [file, view] = await Promise.all([
            fetchStaticFile(entry.file),
            fetchStaticFile(entry.view),
        ]);
        return {
            ...view,
            source: { ...file, ...view.source },
        };
    }
    if (!dataPath)
        throw new Error('Static view data not found');
    return fetchStaticFile(dataPath);
}
