type LatCommandStyle = 'global' | 'local' | 'npx';
/**
 * Remove all lat-owned hook entries from settings, then add fresh ones.
 * Preserves any non-lat hooks the user may have configured.
 */
export declare function syncLatHooks(settingsPath: string, style: LatCommandStyle, agent?: 'claude' | 'codex', root?: string): void;
export declare function readLogo(): string;
export declare function ensureLatLocalConfigIgnored(latDir: string): void;
export declare function initCmd(targetDir?: string): Promise<void>;
export {};
