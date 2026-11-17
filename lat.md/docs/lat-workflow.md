# Lat workflow

Lat gives coding agents project context they can reuse across tasks and sessions, so decisions and constraints do not have to be rediscovered from code.

Follow [[quick-start]] to connect your agent or create the initial graph for an existing project.

## How agent integration works

`lat init` configures your selected coding agents to consult and maintain the knowledge graph as part of their normal workflow. Once setup is active, you usually do not need to ask them to use Lat on each task.

The integration combines instructions, tools, and lifecycle hooks according to what each agent supports:

- **Project instructions:** `AGENTS.md` or agent-specific rules tell the agent to search for relevant knowledge before changing code, update it when meaningful behavior changes, and stage it with the code it describes.
- **Authoring skill:** The installed `lat-md` skill teaches the agent how to write sections, connect them to code, and maintain test specifications.
- **Tool access:** CLI commands, Model Context Protocol (MCP) tools, or native agent tools let the agent search, read, and validate the graph.
- **Prompt hooks:** Supported integrations supply workflow reminders and relevant knowledge from an existing search index when a task starts.
- **Commit checks:** A Git pre-commit hook validates the graph when an agent commits and flags substantial code changes that may need documentation updates.

The exact integration varies. Claude Code and Codex receive prompt-time context through hooks; Cursor uses rules for initial guidance. Pi and OpenCode integrate through an extension or plugin. Copilot and fx use instructions and MCP tools. Commit checks apply to every agent.

Follow the activation instructions printed by `lat init` so the installed integration can run. You can rerun setup to refresh it after upgrading Lat. See [[cli#init|agent setup details]] for the configuration installed for each agent.

## Guide a specific task

Work with your agent as usual. You can still point it to a particular section or remind it to consult Lat when you want to emphasize a constraint or redirect its attention.

## Capture decisions, not transcripts

Keep knowledge that will help the next person or agent make a correct change: domain rules, architectural boundaries, non-obvious decisions, and important test intent.

For authentication, describe when a token becomes invalid and why that rule exists. Link to the implementation instead of copying its code or defaults. Distinguish current behavior from proposals, and remove stale explanations as the project evolves.

Session logs and file inventories do not belong in the graph. Use the installed `lat-md` skill for authoring rules.

## Review intent and evidence

Review whether the knowledge diff describes the behavior you want, then follow its links to inspect the implementation and tests.

Check that new constraints are justified, changed behavior is explicit, and important test expectations have matching references. [[ui|Lat UI]] lets you explore these relationships without navigating files manually.

The integration validates the graph when the agent commits and asks it to review documentation coverage for substantial code changes. Review the meaning of the changes yourself: passing checks confirms structure and references, while you and the agent assess whether the knowledge matches the intended behavior.

## Commit checks

`lat init` asks to install a Git pre-commit hook that validates staged content when an agent commits. Your own commits are not checked, and agents do not run checks at the end of every turn.

Setup asks before installing the hook, then installs it or explains how to integrate with your existing hook manager: see [[lat-workflow#Existing Git hooks]]. The choice is local to each clone and worktree, so run `lat init` in each one.

After validation passes, substantial staged code changes stop the commit with a request to review Lat coverage. If no update is needed or the changes are already covered, the agent may retry with `LAT_BYPASS_COMMIT_HOOK=1 git commit ...`. If coverage is missing, update and stage it first, then retry with the flag. This acknowledges the review for that invocation only; structural validation and other Git hooks still run.

Projects set up with an earlier version need `lat init` rerun after upgrading; `lat check` prints a reminder until you do. The old `--experimental` flag is accepted and ignored.

## Checks without the Git hook

If you decline the Git hook, `lat init` asks whether `lat check` may be enforced through coding agent hooks instead: supported agents run it whenever they finish a turn and keep working until it passes.

If you decline that too, nothing enforces validation; instructions still ask agents to run `lat check`, and you can run it yourself. Rerunning `lat init` offers your earlier answers as defaults, so you can change your mind at any time.

Outside a Git repository the hook cannot be installed. `lat init` warns you first and suggests running `git init`, then `lat init` again; you can also continue without Git and choose agent hooks. After adding Git later, `lat check` reminds you to rerun `lat init` and switch to commit checks.

## Existing Git hooks

When installing commit checks, `lat init` preserves custom hooks and hook managers, and reports whether commit validation was installed or needs integration.

When init reports integration required, add `lat hook git-pre-commit` to your existing pre-commit workflow after commands that modify and stage files. Preserve failures from earlier commands. For Husky, edit `.husky/pre-commit`; for other managers, use their configuration rather than their generated Git hook.

Lat does not change `core.hooksPath`. New clones need their own hook setup, and automatic merge commits require separate pre-merge-commit integration. Agent detection can be lost across remote or custom execution tools; this is a workflow check, not a security boundary.

## Pre-commit validation mode

Commit checks validate staged file versions by default. Projects that rely on ignored checkouts or other local-only link targets can choose working-tree validation.

Add this setting to the YAML frontmatter at the top of the Git repository's `lat.md/lat.md`:

```yaml
---
lat:
  git-pre-commit:
    validation: working-tree
---
```

Stage the configuration file for the setting to take effect. Use `staged`, or omit the setting, to retain strict validation of the commit's contents. The setting applies to all affected projects in the repository.

In `working-tree` mode, the hook runs the regular `lat check` in each affected project's directory. It can resolve local targets and sees unstaged edits, so a passing check describes the files on disk rather than necessarily the versions being committed. In both modes, validation errors block commits even with `LAT_BYPASS_COMMIT_HOOK=1`; that flag skips only the documentation review reminder.

## Fixture projects

Commit checks can exclude intentionally invalid test graphs using the root document's frontmatter.

Add this configuration to the Git repository's `lat.md/lat.md` and stage it with the fixtures:

```yaml
---
lat:
  git-pre-commit:
    exclude-projects:
      - tests/cases
---
```

Paths are literal repository-relative directories using forward slashes, without a trailing slash or globs. Each exclusion covers projects at or beneath that directory. The hook reads the staged setting; ancestor and sibling projects still validate, and explicit `lat check` commands remain available for any fixture.
