type FileTraceResult = {
    fileList: Set<string>;
    warnings: Set<Error>;
};
export type VercelBuildDependencies = {
    traceFiles: (files: string[], options: {
        base: string;
        conditions: string[];
        exportsOnly: boolean;
        processCwd: string;
    }) => Promise<FileTraceResult>;
};
export type VercelBuildOptions = {
    force?: boolean;
    warn?: (message: string) => void;
};
export type VercelBuildResult = {
    files: number;
    functionPath: string;
    outputDir: string;
};
/** Convert an installed portable Lat UI server into Vercel Build Output API v3. */
export declare function buildVercelOutput(requestedArtifact: string, requestedOutput?: string, options?: VercelBuildOptions, dependencies?: VercelBuildDependencies): Promise<VercelBuildResult>;
export {};
