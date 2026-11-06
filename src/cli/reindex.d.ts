import type { CmdContext, CmdResult } from '@lat.md/core/context';
/**
 * Rebuild the embedding index. Honors the durable per-repo backend preference:
 * a repo pinned to local rebuilds local and ignores the key. `--local` forces
 * local; `--remote` forces re-resolving from the key (the escape hatch back to
 * hosted); a bare run on an unpinned repo decides from the env. If a key is set
 * but rejected, offers to switch to local (`--yes` answers non-interactively).
 */
export declare function reindexCommand(ctx: CmdContext, opts: {
    local?: boolean;
    remote?: boolean;
    yes?: boolean;
}): Promise<CmdResult>;
