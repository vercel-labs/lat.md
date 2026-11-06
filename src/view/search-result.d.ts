import type { SectionMatch } from '@lat.md/core/lattice-model';
import type { ViewSearchResult } from './protocol.js';
/** Convert one graph section match into the browser search protocol. */
export declare function viewSearchResult(latDir: string, match: SectionMatch, documentPaths?: ReadonlyMap<string, string>): ViewSearchResult;
