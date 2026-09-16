import type {
  SearchEvidence,
  SearchDiagnostics,
} from '@lat.md/core/search-metadata';
export type {
  SourceSpan,
  SearchEvidence,
  SearchDiagnostics,
} from '@lat.md/core/search-metadata';
export type SearchResult = {
  id: string;
  file: string;
  heading: string;
  content: string;
  rankScore: number;
  semanticSimilarity?: number;
  semanticRank?: number;
  lexicalScore?: number;
  lexicalRank?: number;
  evidence: SearchEvidence[];
  diagnostics: SearchDiagnostics;
};
