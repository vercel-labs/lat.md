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
