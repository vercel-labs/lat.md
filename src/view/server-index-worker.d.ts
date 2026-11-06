import type { MarkdownProjectAnalysis } from '@lat.md/core/project-analysis';
export type ServerIndexRequest = {
    latDir: string;
    project: MarkdownProjectAnalysis;
    cacheDir: string;
};
