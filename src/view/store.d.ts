import { type ExternalResolver } from '@lat.md/core/external-sources';
import type { Section } from '@lat.md/core/lattice-model';
import { type ViewGitRepository, type ViewGitSnapshot } from './git.js';
import type { ViewDocument, ViewDocumentEditResponse, ViewDocumentError, ViewDocumentSource, ViewExternalDocument, ViewGraph, ViewIndex, ViewProjectGeneration, ViewDocumentTree, ViewSourceDocument } from './protocol.js';
import { type ViewCodeReferenceFile, type ViewParsedMarkdownFile, type ViewReferenceIndex } from './references.js';
export type ViewProjectSnapshot = {
    generation: number;
    markdownGeneration: number;
    files: ReadonlyMap<string, ViewParsedMarkdownFile>;
    allSections: Section[];
    references: ViewReferenceIndex;
    graph: ViewGraph;
    diagnostics: ReadonlyMap<string, readonly ViewDocumentError[]>;
    git: ViewGitSnapshot;
    index: ViewIndex;
    external: ExternalResolver;
};
export type ViewStoreOptions = {
    /** Export-only allowlist, applied before source/backlink/resource reads. */
    publishable?: (path: string) => Promise<boolean>;
    codeExcludePaths?: string[];
    debounceMs?: number;
    git?: boolean;
    gitPollMs?: number;
    watch?: boolean;
    externalIgnoreLocal?: boolean;
    externalCa?: string | Buffer;
};
type ViewStoreListener = (change: ViewProjectGeneration) => void;
/** Own the immutable, incrementally refreshed project snapshot for `lat ui`. */
export declare class ViewStore {
    readonly latDir: string;
    readonly projectRoot: string;
    private readonly realLatDir;
    private readonly gitRepository;
    private readonly options;
    private snapshotValue;
    private codeFiles;
    private codeScope;
    private ignoredCodePaths;
    private listeners;
    private watcher;
    private externalWatchers;
    private pendingPaths;
    private debounceTimer;
    private gitPollTimer;
    private gitPollQueued;
    private refreshTail;
    private editTail;
    private closed;
    constructor(latDir: string, projectRoot: string, realLatDir: string, snapshot: ViewProjectSnapshot, codeFiles: Map<string, ViewCodeReferenceFile>, codeScope: Set<string>, gitRepository: ViewGitRepository | null, options: ViewStoreOptions);
    get snapshot(): ViewProjectSnapshot;
    get markdownGeneration(): number;
    startWatching(): void;
    private refreshExternalWatchers;
    subscribe(listener: ViewStoreListener): () => void;
    getIndex(): ViewIndex;
    getGraph(): ViewGraph;
    renderSectionOutput(markdown: string, sectionId: string): Promise<ViewDocumentTree>;
    private projectPreviewFile;
    private getProjectDocument;
    getDocument(requestedPath: string): Promise<ViewDocument>;
    private editableDocumentPath;
    getDocumentSource(requestedPath: string): Promise<ViewDocumentSource>;
    getDocumentResource(requestedPath: string): Promise<Buffer>;
    editDocument(requestedPath: string, baseContent: string, editedContent: string): Promise<ViewDocumentEditResponse>;
    getSource(requestedPath: string, requestedSymbol?: string, origin?: {
        sectionId: string;
        line: number;
    }, requestedLine?: number): Promise<ViewSourceDocument>;
    getExternal(target: string): Promise<ViewExternalDocument>;
    refresh(paths: string[]): Promise<void>;
    private queueRefresh;
    close(): Promise<void>;
    private scheduleRefresh;
    private startGitPolling;
    private readMarkdownFile;
    private applyRefresh;
}
/** Build the initial project snapshot and optionally begin incremental updates. */
export declare function createViewStore(latDir: string, projectRoot: string, options?: ViewStoreOptions): Promise<ViewStore>;
export {};
