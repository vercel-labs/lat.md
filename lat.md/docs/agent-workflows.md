# Agent workflows

Lat gives coding agents durable project context and a validation loop that keeps that context synchronized with implementation.

## Setup

`lat init` configures supported agents interactively and can generate shared instructions, skills, MCP registrations, plugins, and lifecycle hooks.

Follow any activation instructions from setup. Your configured agent should then follow this loop automatically:

1. Use the installed `lat-md` skill, search the graph, and expand explicit `[[refs]]` before work.
2. Read exact sections instead of guessing from snippets.
3. Update `lat.md/` when architecture, behavior, tests, or plans materially change.
4. Run `lat check` before finishing.

## What to capture

Keep the graph a concise description of intent: what the system does, why, and the constraints that matter when changing it.

Capture domain rules, non-obvious decisions, architectural boundaries, and important test intent. Link related concepts and implementation symbols rather than copying code or defaults. Distinguish established behavior from proposals and uncertain rationale.

Do not turn Lat into a file inventory, session journal, or dump of everything you discover. Revise or remove stale knowledge as the code evolves so humans and agents share a useful, current picture of the project.

## Context tools

Agents can use the CLI directly or the matching MCP tools for search, section inspection, reference lookup, expansion, and validation.

`lat expand` is useful at prompt boundaries: it resolves authored wiki links and appends their full context. `lat external show` lets an agent inspect a pinned upstream source before deciding whether it needs an editable checkout.

## Review

Knowledge diffs summarize semantic change, so reviewers can understand intent before descending into implementation details.

Work on features with your agent and let it maintain the graph. Focus review on behavior, constraints, and test expectations; use `lat ui` to explore links and check that the graph reflects the project's vision.

Required test specifications and `@lat:` comments make important coverage visible from either direction. Stop hooks can remind an agent when a large code change has no corresponding knowledge update without preventing projects from using Lat outside Git.
