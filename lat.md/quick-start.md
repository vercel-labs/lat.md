# Quick start

Install Lat and connect your coding agent, then let it maintain the project's knowledge while you review intent and behavior.

## For humans

Install Lat and run the setup wizard in your project. Select your coding agent and follow any activation instructions.

```bash
npm install -g lat.md
cd your-project
lat init
```

Lat creates `lat.md/` and configures your selected agent to consult the graph before work, keep it current, and validate it before finishing. It should now use Lat automatically; you do not need to write the initial Markdown yourself.

For a new project, you're all set—start building. For an existing project, copy this prompt into your coding agent to seed the graph:

```markdown
Use the installed `lat-md` skill to build an initial
knowledge graph for this project in `lat.md/`. Do not change
application behavior.

## Capture intent

Inspect the existing docs, code, and tests. Capture the
project's purpose, architecture, domain rules, non-obvious
constraints, key decisions, and important test intent.

Keep it concise: explain what the system does and why, not a
file-by-file tour or a copy of the code. Distinguish
verified behavior from inferred intent, and flag important
unknowns for my review instead of inventing rationale.

## Connect the graph

Link related concepts, source symbols, and important tests.
Keep directory indexes complete so the graph is easy to
navigate.

## Validate and summarize

Run `lat check` and fix the reported errors. Then summarize
what you captured and what needs my review.
```

Then use this loop:

1. Work on features with your agent as usual; let it update `lat.md/` alongside the code.
2. Focus your review on the knowledge diff: intent, behavior, constraints, and test expectations. Use that context to guide code review.
3. Run `lat ui` to visualize the graph, follow links, and explore the project's knowledge together.

See [[browser]] for the UI and [[commands]] for the CLI reference.

## For agents

Keep a concise knowledge graph of intent that evolves with the code, helping humans and agents align on the project and ship faster.

- If the `lat` command is missing, ask your human to install `lat.md` and run `lat init` in the project.
- Use the installed `lat-md` skill. Search and read relevant knowledge before making changes.
- Capture semantics: what the system does, why, its important constraints, and test intent. Link concepts to each other and to code.
- Be selective. Do not dump code, file inventories, session logs, or trivia into Lat; link to implementation details instead of duplicating them.
- Update the graph as meaningful behavior or decisions change. Always run `lat check` before finishing and fix any errors.

See [[agent-workflows]] for more guidance and [[concepts]] for the knowledge model.
