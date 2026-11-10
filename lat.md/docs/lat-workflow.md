# Lat workflow

Lat gives coding agents project context they can reuse across tasks and sessions, so decisions and constraints do not have to be rediscovered from code.

Follow [[quick-start]] to connect your agent or create the initial graph for an existing project.

## How agent integration works

`lat init` configures your selected coding agents to consult and maintain the knowledge graph as part of their normal workflow. Once setup is active, you usually do not need to ask them to use Lat on each task.

The integration combines instructions, tools, and lifecycle hooks according to what each agent supports:

- **Project instructions:** `AGENTS.md` or agent-specific rules tell the agent to search for relevant knowledge before changing code, update it when meaningful behavior changes, and stage relevant documentation with the implementation.
- **Authoring skill:** The installed `lat-md` skill teaches the agent how to write sections, connect them to code, and maintain test specifications.
- **Tool access:** CLI commands, Model Context Protocol (MCP) tools, or native agent tools let the agent search, read, and validate the graph.
- **Hooks:** Prompt hooks supply relevant knowledge from an existing search index. The Git pre-commit hook validates staged changes when an agent commits; ordinary manual commits skip Lat validation.

Claude Code and Codex receive prompt-time context; Cursor uses rules for initial guidance. Pi and OpenCode provide native tools through an extension or plugin. Copilot uses instructions and MCP tools. None of these integrations run validation at the end of each turn.

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

The Git hook validates the staged graph and source references before agent commits. Fix reported errors and stage the fixes before retrying. You can also run `lat check` while editing. Review the meaning of the changes yourself: passing checks confirms structure and references, while you and the agent assess whether the knowledge matches the intended behavior.

## Existing Git hooks

`lat init` preserves custom hooks and hook managers, and reports whether commit validation was installed or needs integration.

When init reports integration required, add `lat hook git-pre-commit` to your existing pre-commit workflow after commands that modify and stage files. Preserve failures from earlier commands. For Husky, edit `.husky/pre-commit`; for other managers, use their configuration rather than their generated Git hook.

Lat does not change `core.hooksPath`. New clones need their own hook setup, and automatic merge commits require separate pre-merge-commit integration. Agent detection can be lost across remote or custom execution tools; this is a workflow check, not a security boundary.

## Fixture projects

Exclude intentionally invalid test graphs from automatic commit validation using the root document's frontmatter.

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
