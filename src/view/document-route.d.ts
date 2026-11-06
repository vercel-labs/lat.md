/** Fail explicitly when a document would shadow the UI or a generated file. */
export declare function validateDocumentRoutes(paths: readonly string[]): void;
/** Build the canonical, extensionless browser route for a Markdown file. */
export declare function documentUrl(path: string, fragment?: string): string;
/** Resolve an extensionless browser route back to its Markdown file path. */
export declare function documentPath(pathname: string): string | null;
/** Resolve an explicit `.md` route to the raw Markdown file it requests. */
export declare function rawDocumentPath(pathname: string): string | null;
/** Build the browser route for a non-Markdown file stored in the vault. */
export declare function documentResourceUrl(path: string): string;
/** Resolve a browser resource route to a safe vault-relative file path. */
export declare function documentResourcePath(pathname: string): string | null;
/** Keep relative Markdown-to-Markdown links inside the rendered document UI. */
export declare function rewriteDocumentLink(value: string, sourcePath: string): string;
