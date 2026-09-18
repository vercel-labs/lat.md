# Agent workflows

Lat gives coding agents project context they can reuse across tasks and sessions, so decisions and constraints do not have to be rediscovered from code.

Follow [[quick-start]] to connect your agent or create the initial graph for an existing project.

## Give agents relevant context

Ask your agent to search the graph before changing code, or point it to a specific section with a wiki link in your request.

For example, if your graph contains an `auth#Refresh rotation` section:

```markdown
Read [[auth#Refresh rotation]] before changing token renewal.
Keep the documented constraints intact, and update the graph
if the intended behavior changes.
```

Agents can retrieve context through the CLI or Model Context Protocol (MCP) tools configured during setup. `lat expand` resolves wiki links in a prompt and includes their content. See [[commands]] for the available commands.

## Capture decisions, not transcripts

Keep knowledge that will help the next person or agent make a correct change: domain rules, architectural boundaries, non-obvious decisions, and important test intent.

For authentication, describe when a token becomes invalid and why that rule exists. Link to the implementation instead of copying its code or defaults. Distinguish current behavior from proposals, and remove stale explanations as the project evolves.

Session logs and file inventories do not belong in the graph. Use the installed `lat-md` skill for authoring rules.

## Review intent and evidence

Review whether the knowledge diff describes the behavior you want, then follow its links to inspect the implementation and tests.

Check that new constraints are justified, changed behavior is explicit, and important test expectations have matching references. [[browser|Lat UI]] lets you explore these relationships without navigating files manually.

Have the agent run `lat check` before finishing. Configured stop hooks can remind it about missing knowledge updates, but neither reminders nor validation replace your review of meaning.
