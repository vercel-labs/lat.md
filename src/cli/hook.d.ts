/**
 * Measure code vs `lat.md/` churn since HEAD, in lines. Combines tracked
 * changes (`git diff HEAD --numstat`) with untracked files
 * (`git ls-files --others --exclude-standard -z`). Counting untracked files is
 * what makes a freshly scaffolded, never-committed `lat.md/` register as
 * updated — otherwise its edits are invisible to `git diff HEAD` and the sync
 * reminder fires on every turn until `lat.md/` is committed (issue #61).
 * Both scans are scoped and made relative to `projectRoot`, so a Lat project
 * nested in a larger worktree neither misses its own `lat.md/` paths nor counts
 * changes from sibling projects.
 * Outside a Git worktree both scans contribute zero churn by design: Git is
 * optional, so the hook still validates the project but skips the sync ratio.
 */
export declare function analyzeDiff(projectRoot: string): {
    codeLines: number;
    latMdLines: number;
};
export declare function hookCmd(agent: string, event: string): Promise<void>;
