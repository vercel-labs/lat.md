import { SearchDb } from './db.js';
/** Build a private staging database; access locks protect copies and publication of search.db. */
export declare function writeIndex<T>(latDir: string, cacheDir: string | undefined, rebuild: boolean, work: (db: SearchDb, storedModel: string | null) => Promise<T>): Promise<T>;
