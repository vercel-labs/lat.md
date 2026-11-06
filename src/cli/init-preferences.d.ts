/** Read machine-local checklist defaults without inferring installed agents. */
export declare function readInitAgents(latDir: string): string[];
/** Update just the confirmed selection, preserving other YAML and comments. */
export declare function writeInitAgents(latDir: string, agents: string[]): void;
