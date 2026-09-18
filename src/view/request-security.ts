import type { IncomingMessage } from 'node:http';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const urlHost = (host: string) =>
  host.includes(':') && !host.startsWith('[')
    ? `[${host}]`
    : host.toLowerCase();

/** Check the actual listener authority; forwarding headers are not trusted. */
export function trustedLiveRequest(
  req: IncomingMessage,
  configuredHost: string,
): boolean {
  const authority = req.headers.host;
  if (!authority || !/^[a-z\d.\-:[\]]+$/i.test(authority)) return false;
  let url: URL;
  try {
    url = new URL(`http://${authority}`);
  } catch {
    return false;
  }
  if (Number(url.port || 80) !== req.socket.localPort) return false;
  const host = urlHost(configuredHost);
  const allowed = new Set([host]);
  if (LOOPBACK_HOSTS.has(host) || host === '0.0.0.0' || host === '[::]') {
    for (const name of LOOPBACK_HOSTS) allowed.add(name);
    if (req.socket.localAddress) allowed.add(urlHost(req.socket.localAddress));
  }
  if (!allowed.has(url.hostname)) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== url.origin) return false;
  if (
    !['GET', 'HEAD'].includes(req.method ?? 'GET') &&
    req.headers['sec-fetch-site'] === 'cross-site'
  )
    return false;
  // Do not accept an absolute-form URL for a different authority.
  try {
    if (new URL(req.url ?? '/', url).origin !== url.origin) return false;
  } catch {
    return false;
  }
  return true;
}

/** Untrusted repository resources cannot execute with the editor's origin. */
export const RESOURCE_CONTENT_SECURITY_POLICY =
  "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
