/** Point Vite's entry assets at the route-independent deployment prefix. */
export function rewriteClientAssetUrls(html, basePath) {
    const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return html.replace(/(["'])(?:\.\/|\/)assets\//g, (_match, quote) => `${quote}${normalizedBase}assets/`);
}
