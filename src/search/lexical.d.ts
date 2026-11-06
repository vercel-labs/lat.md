import { type SearchDb } from './db.js';
export declare const LEXICAL_VERSION: string;
/** Same analysis for indexed fields and queries; exact identifiers bypass it. */
export declare function lexicalTokens(text: string): string[];
/** Populate derived lexical rows, reusing original passages and vectors. */
export declare function synchronizeLexical(db: SearchDb): Promise<void>;
