# Concepts

Lat connects explanations of your project to each other and to code, so people and agents can find relevant context and check that its references still work.

## Vault and sections

A project's `lat.md/` directory is its vault. Each Markdown heading defines a section that can be linked, searched, and read on its own.

For example, `auth#Tokens#Rotation` identifies the Rotation heading inside Tokens in `auth.md`. Each section starts with a short paragraph so search results carry useful context.

Every directory has a same-named index document listing its pages and subdirectories. This keeps all knowledge reachable through the graph.

## Links

Wiki links point to another section, a repository file or directory, or a named symbol in supported source code.

For example, these links target a documented request pipeline, a schema file, and a server method:

```md
[[architecture#Request pipeline]]
[[schema.sql]]
[[src/server.ts#Server#listen]]
```

Files in unsupported formats can still be linked, but Lat cannot navigate to sections or symbols inside them. [[upstream|External sources]] extend links to documentation and code in other repositories.

Ordinary Markdown links also work; Lat checks their local destinations.

## Code references and test specs

An `@lat:` comment points from code to the section that explains its intent. Lat can then show which implementations or tests refer to that knowledge.

For a project documenting refresh-token rotation:

```ts
// @lat: [[auth#Refresh rotation]]
export function rotateToken() {}
```

Test-spec documents can require each leaf section, one with no subsections, to have a code reference. This checks that a backlink exists, not that the test proves the documented behavior. See [[markdown#Frontmatter#require-code-mention|required code mentions]] for the syntax.

## What Lat checks

`lat check` reports broken links, missing source symbols, malformed sections, incomplete directory indexes, and missing required code references.

It checks structure and references, not whether the prose accurately describes the application. Review intent and behavior with your agent; use validation to catch structural drift.

## Find relevant knowledge

Search in natural language when you know the topic but not the section name.

```bash
lat search "how do refresh tokens work?"
```

Use `lat locate` to find a section by name, `lat section` to read it, and `lat refs` to find what references it. [[browser|Lat UI]] provides visual navigation; [[commands]] lists the command syntax.
