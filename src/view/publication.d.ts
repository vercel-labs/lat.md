/** Publication scope is deliberately narrower than interactive source browsing. */
export declare function createPublicationPolicy(projectRoot: string): Promise<(path: string) => Promise<boolean>>;
