export declare function staticViewBasePath(): string | null;
export declare function isStaticView(): boolean;
/** Resolve the homepage in both a live shell and a portable snapshot. */
export declare function viewEntryPath(): string | null;
/** Return the optional dynamic search endpoint attached to a static build. */
export declare function staticViewSearchApi(): string | null;
/** Prefix a bundled root asset with the static deployment base path. */
export declare function staticViewAssetUrl(assetUrl: string, basePath?: string | null): string;
/** Strip the configured deployment prefix and static route trailing slash. */
export declare function viewPathname(pathname: string): string;
export declare function staticViewRoute(path: string): string | null;
