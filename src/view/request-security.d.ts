import type { IncomingMessage } from 'node:http';
/** Check the actual listener authority; forwarding headers are not trusted. */
export declare function trustedLiveRequest(req: IncomingMessage, configuredHost: string): boolean;
/** Untrusted repository resources cannot execute with the editor's origin. */
export declare const RESOURCE_CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
