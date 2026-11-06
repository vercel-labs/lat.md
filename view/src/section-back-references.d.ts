type ClipboardWriter = Pick<Clipboard, 'writeText'>;
/** Copy the canonical ID accepted by `lat section`. */
export declare function copySectionId(sectionId: string, clipboard?: ClipboardWriter): string;
/** Build the live endpoint that runs `lat section` for one canonical ID. */
export declare function sectionOutputRequestUrl(sectionId: string): string;
/** Navigate to one rendered section and copy its absolute browser URL. */
export declare function navigateAndCopySectionLink(currentHref: string, headingId: string, navigate: (url: URL) => void, clipboard?: ClipboardWriter): URL;
export {};
