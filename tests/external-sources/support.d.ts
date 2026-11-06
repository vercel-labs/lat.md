export declare const TEST_CERT_PATH: string;
export type ExternalGitFixture = {
    root: string;
    checkout: string;
    commit1: string;
    commit2: string;
    repoUrl: string;
    fetchUrl: string;
    ca: Buffer;
    rawRequests: Map<string, number>;
    close(): Promise<void>;
};
export declare function createExternalGitFixture(documents?: Record<string, string>): Promise<ExternalGitFixture>;
export declare function createExternalProject(fixture: ExternalGitFixture, options: {
    strategy: 'fetch' | 'checkout';
    commit?: string;
    localPath?: string;
    defaultFileExtension?: string;
    body?: string;
}): {
    root: string;
    latDir: string;
};
