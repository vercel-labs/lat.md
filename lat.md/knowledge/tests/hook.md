---
lat:
  require-code-mention: true
---

# Hook

Git and agent integration tests verify staged validation, manual-commit exclusions, conservative installation, and migration from completion hooks.

Tests use real temporary Git repositories and invoke the source CLI, including actual commits with Git-provided indexes and linked worktrees. Implementations live in [[tests/git-hook.test.ts]] and [[tests/hook.test.ts]].

## Legacy stop hooks are silent

Legacy Claude, Codex, and Cursor stop commands exit successfully without reading stdin or validating broken projects, so stale settings do not interrupt agents.

## Prompt hooks do not expand references

Claude and Codex prompt hooks retain search guidance without expanding wiki links, requesting manual expansion, or asking users to repair unresolved prompt references.

## Codex hook setup preserves non-lat hooks

Syncing Codex hooks installs prompt context and removes Lat stop commands while preserving unrelated handlers and metadata.

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
