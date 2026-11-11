# Lat workflow

Lat gives coding agents project context they can reuse across tasks and sessions, so decisions and constraints do not have to be rediscovered from code.

Follow [[quick-start]] to connect your agent or create the initial graph for an existing project.

## How agent integration works

`lat init` configures your selected coding agents to consult and maintain the knowledge graph as part of their normal workflow. Once setup is active, you usually do not need to ask them to use Lat on each task.

The integration combines instructions, tools, and lifecycle hooks according to what each agent supports:

- **Project instructions:** `AGENTS.md` or agent-specific rules tell the agent to search for relevant knowledge before changing code, update it when meaningful behavior changes, and run `lat check` before finishing.
- **Authoring skill:** The installed `lat-md` skill teaches the agent how to write sections, connect them to code, and maintain test specifications.
- **Tool access:** CLI commands, Model Context Protocol (MCP) tools, or native agent tools let the agent search, read, and validate the graph.
- **Lifecycle hooks:** Supported integrations reinforce the workflow at task boundaries. Prompt hooks can supply relevant knowledge from an existing search index; end-of-task hooks run validation and flag changes that may need documentation updates.

The exact hooks vary. Claude Code and Codex receive prompt-time context and completion checks; Cursor uses rules for initial guidance and a stop hook for completion checks. Pi and OpenCode integrate through an extension or plugin. Copilot uses instructions and MCP tools.

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

The integration directs the agent to run `lat check` before finishing, and supported completion hooks also run validation and flag possible documentation gaps. Review the meaning of the changes yourself: passing checks confirms structure and references, while you and the agent assess whether the knowledge matches the intended behavior.

## Experimental commit hooks

Run `lat init --experimental` to choose experimental features for this project. The checklist explains each experiment and starts with your saved choices.

Enable **Replace end-of-turn checks with Git commit checks** to validate staged content when an agent commits. Setup removes Lat completion hooks, refreshes installed integrations, and installs the Git hook or explains how to integrate with your existing hook manager. Prompt context remains enabled; ordinary manual commits skip validation.

After validation passes, substantial staged code changes stop the commit with a request to review Lat coverage. If no update is needed or the changes are already covered, the agent may retry with `LAT_BYPASS_COMMIT_HOOK=1 git commit ...`. If coverage is missing, update and stage it first, then retry with the flag. This acknowledges the review for that invocation only; structural validation and other Git hooks still run.

Choices are stored locally in `lat.md/.cache/experiments.json`. Normal `lat init` runs preserve them. Rerun `lat init --experimental` and uncheck the experiment to restore completion checks. Choosing experiments requires an interactive terminal. Deleting the cache resets the choices; rerun init afterward to synchronize installed integrations.

The cache is already excluded by the `.cache` rule in the scaffolded `lat.md/.gitignore`. Experiment setup does not add a duplicate cache rule to the repository's root `.gitignore`.

## Existing Git hooks


When the commit-hooks experiment is enabled, `lat init` preserves custom hooks and hook managers, and reports whether commit validation was installed or needs integration.

When init reports integration required, add `lat hook git-pre-commit` to your existing pre-commit workflow after commands that modify and stage files. Preserve failures from earlier commands. For Husky, edit `.husky/pre-commit`; for other managers, use their configuration rather than their generated Git hook.

Lat does not change `core.hooksPath`. New clones need their own hook setup, and automatic merge commits require separate pre-merge-commit integration. Agent detection can be lost across remote or custom execution tools; this is a workflow check, not a security boundary.

## Pre-commit validation mode

The commit-hooks experiment checks staged file versions by default. Projects that rely on ignored checkouts or other local-only link targets can choose working-tree validation.

Add this setting to the YAML frontmatter at the top of the Git repository's `lat.md/lat.md`:

```yaml
---
lat:
  git-pre-commit:
    validation: working-tree
---
```

Stage the configuration file for the setting to take effect. Use `staged`, or omit the setting, to retain strict validation of the commit's contents. The setting applies to all affected opted-in projects in the repository.

In `working-tree` mode, the hook runs the regular `lat check` in each affected project's directory. It can resolve local targets and sees unstaged edits, so a passing check describes the files on disk rather than necessarily the versions being committed. In both modes, validation errors block commits even with `LAT_BYPASS_COMMIT_HOOK=1`; that flag skips only the documentation review reminder.

## Fixture projects

The commit-hooks experiment can exclude intentionally invalid test graphs using the root document's frontmatter.

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
