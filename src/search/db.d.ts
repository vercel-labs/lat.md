export declare const INDEX_FILE = "search.db";
export declare const CREATE_PASSAGE_FTS = "CREATE INDEX IF NOT EXISTS chunks_fts ON lexical_chunks USING fts(body,heading,path) WITH (tokenizer='whitespace',weights='body=1.0,heading=2.0,path=0.5')";
export declare function hasIndex(cacheDir: string): boolean;
/** Small SQL adapter; callers never depend on a libSQL connection. */
export declare class SearchDb {
    readonly path: string;
    private readonly published;
    private connection;
    private release;
    constructor(path: string, published?: boolean);
    private get;
    private connect;
    execute(statement: string | {
        sql: string;
        args?: any[];
    }): Promise<{
        rows: any[];
    }>;
    close(): Promise<void>;
    checkpoint(): Promise<void>;
}
export declare function openDb(latDir: string, requestedCacheDir?: string, published?: boolean): SearchDb;
export declare function ensureMeta(db: SearchDb): Promise<void>;
export declare function getStoredModel(db: SearchDb): Promise<string | null>;
export declare function setStoredModel(db: SearchDb, value: string): Promise<void>;
export declare function ensureSectionsSchema(db: SearchDb, _dimensions: number): Promise<void>;
export declare function dropSections(db: SearchDb): Promise<void>;
export declare function closeDb(db: SearchDb): Promise<void>;
