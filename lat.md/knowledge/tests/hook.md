---
lat:
  require-code-mention: true
---

# Hook

Git and agent integration tests verify staged validation, manual-commit exclusions, conservative installation, and migration from completion hooks.

Tests use real temporary Git repositories and invoke the source CLI, including actual commits with Git-provided indexes and linked worktrees. Implementations live in [[tests/git-hook.test.ts]] and [[tests/hook.test.ts]].

## Legacy stop hooks are silent

In opted-in projects, Claude, Codex, and Cursor stop commands exit successfully without reading stdin or validating broken projects, so stale settings do not interrupt agents.

## Prompt hooks do not expand references

Claude and Codex prompt hooks retain search guidance without expanding wiki links, requesting manual expansion, or asking users to repair unresolved prompt references.

## Codex hook setup preserves non-lat hooks

Syncing Codex hooks installs the selected workflow while preserving unrelated handlers and metadata. Stable setup includes Stop validation; opted-in projects retain only prompt context.

## Local JavaScript hook commands retain Node

Local compiled JavaScript entry points retain the Node launcher in generated prompt hooks, so non-executable compiler output remains usable.

## Agent detection protects manual commits

Package detection recognizes agent commands while broad Claude IDE markers alone skip enforcement. Explicit agent identity and the Claude child marker enable validation; manual commits skip even broken staged docs.

## Validates the index without touching work

An initial commit validates staged blobs, rejects staged errors even when working files are fixed, and preserves both the original index bytes and unstaged edits.

## Uses Git commit indexes

Real Git commits verify that the installed hook respects indexes supplied for commit-all and path-specific commits, blocking source changes until matching documentation is included.

## Checks deletions and nested projects

Staged nested Lat projects are discovered from the index; deleting a referenced source file fails validation in the owning project.

## Contains staged symlinks

A staged link escaping the exported tree is rejected before validation can read outside the snapshot.

## Accepts contained symlinks under aliased temporary directories

A temporary directory with a symlink ancestor accepts staged links whose targets stay inside the snapshot, covering macOS temporary paths and equivalent aliases on other systems.

## Excludes fixture projects using staged configuration

Staged exclusions allow deliberately broken fixtures while unstaged exclusions have no effect. Directory boundaries preserve similarly named siblings, and ancestor projects still validate their own graph and source references.

## Rejects invalid project exclusions

Malformed exclusion lists, absolute paths, and dot components fail validation instead of silently skipping projects or broadening the configured scope.

## Installs only owned Git hooks

Fresh hooks install and refresh idempotently. Existing custom hooks and edited Lat hooks remain unchanged, with integration instructions instead of replacement.

## Preserves hook managers and custom paths

Husky, pre-commit, Lefthook, and custom hooksPath configurations receive integration instructions without writing a competing Git hook.

## Shares hooks across worktrees

Linked worktrees share the installed hook, but validation reads the committing worktree and does not capture the installation directory.

## Migrates lifecycle hooks without collateral changes

Migration removes Lat commands within mixed hook entries while retaining unrelated commands, event matchers, and Cursor prompt handlers.

## Missing runtime does not strand commits

If an installed runtime disappears, the launcher permits commits and prints a repair instruction instead of leaving the repository unusable.

## Exits silently when check passes and no diff

When `lat check` passes and there is no git diff output, the hook produces no stdout and no stderr — the agent stops cleanly.

## Supports projects outside Git

Git version control is optional. Outside a Git worktree, the Stop hook skips diff-based sync analysis but still runs `lat check`; valid projects exit silently, while validation errors still block.

## Blocks when lat check fails

When `lat check` finds errors, the hook outputs a block decision with a reason mentioning `lat check` and the error count.

## Blocks when code diff is large but lat.md/ not updated

When check passes but `git diff --numstat` shows code changes above the threshold with no `lat.md/` changes, the hook blocks with a reminder to update `lat.md/`.

## Exits silently when lat.md/ changes are proportional

When code changes are large but `lat.md/` changes exceed the 5% ratio, the hook exits silently.

## Exits silently when code diff is below threshold

When code changes are below 5 lines, the ratio check is skipped and the hook exits silently.

## Blocks with both messages when check fails and diff needs sync

When `lat check` fails and the diff also needs sync, the block reason covers both updating `lat.md/` and running `lat check` until it passes.

## Exits silently on second pass when check passes

On the second pass (`stop_hook_active: true`), if `lat check` passes, the hook exits silently with no output.

## Prints stderr warning on second pass when check still fails

On the second pass, if `lat check` still fails, the hook prints a warning to stderr but does not block — the loop stops.

## Ignores non-code files in diff

Files that don't match `SOURCE_FILE_EXTENSIONS` (e.g. `.md`) are not counted toward code lines, so a large markdown-only diff does not trigger a sync reminder.

## Cursor stop hook returns follow-up work instead of a Claude block

When Cursor needs more work at stop time, the hook returns a `followup_message` payload instead of Claude's `decision: "block"` shape so the agent keeps going in Cursor's native hook format.

## Codex stop hook returns a block decision

When Codex needs more work at stop time, the hook returns the same guarded `decision: "block"` continuation payload used for Claude.

## Counts tracked and untracked files together

Diff analysis combines tracked churn with relevant untracked `lat.md/` and supported source files while respecting nested `.gitignore` rules and safely skipping unrelated paths.

The integration fixture nests the Lat project inside a larger worktree, verifies sibling changes are excluded, and covers spaces and non-ASCII characters in untracked paths.

## Counts untracked files before the first commit

When `HEAD` does not exist yet, tracked diff analysis may fail but untracked `lat.md/` and supported source files still contribute their complete line counts.

## Prompt guidance follows the selected workflow

Prompt hooks read each project's saved experiment choices and describe completion checks by default or staged commit checks when opted in.

## Git validation requires explicit opt-in

Missing or disabled project choices make the Git hook skip even broken staged graphs. Linked worktrees retain independent opt-ins despite sharing the installed launcher.

## Staged code review reminders are advisory

An initial agent commit with enough staged code prints one optional review reminder and succeeds, even when substantial Lat changes are already staged. Documentation churn does not prove semantic coverage.

## Review reminders use only staged code churn

Suggestions ignore untracked code, unstaged edits, documentation-only changes, and small staged edits. Staged additions and deletions count, unusual filenames remain intact, and reminders do not hide validation failures.

## Review reminders respect project scope

Suggestions count only source changes within affected opted-in projects and outside excluded fixture subtrees. A root project’s opt-out prevents unrelated root changes from triggering reminders for an opted-in nested project.
