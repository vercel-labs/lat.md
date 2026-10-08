# Concepts

Lat organizes project knowledge in Markdown files made up of sections. Sections link to one another and to the codebase, while references in code link back to the sections that explain it.

Together, these connections form a knowledge graph. Lat gives people and agents tools to validate its structure and links, search its contents, and visualize and navigate the graph.

## Vault and sections

A project's `lat.md/` directory is its vault. Each Markdown heading defines a section that can be linked, searched, and read on its own.

For example, `lat.md/auth.md` could contain:

```md
# Tokens

Tokens identify authenticated sessions and limit how long access remains valid.

## Rotation

Refresh tokens are replaced after use to prevent an old token from being reused.
```

The section id `auth#Tokens#Rotation` identifies the Rotation heading inside Tokens in `auth.md`. Each section starts with a short paragraph so search results carry useful context.

Every directory has a same-named index document listing its pages and subdirectories. For example, `lat.md/lat.md` lists the vault's contents. This keeps knowledge reachable as the graph grows.

## Links

Wiki links connect sections to other sections, repository files and directories, and named symbols in supported source code. In source comments, they connect code back to documented knowledge.

These examples show the kinds of targets you can reference in a project:

| Target | Example | Meaning |
| --- | --- | --- |
| Document | `[[auth]]` | The authentication document |
| Section | `[[auth#Tokens#Rotation]]` | The Rotation section nested under Tokens |
| Section by full path | `[[lat.md/auth#Tokens#Rotation]]` | The same section, with a path to distinguish it from similarly named documents |
| Section with a display label | `[[auth#Tokens#Rotation\|token rotation]]` | A link displayed as “token rotation” |
| Repository file | `[[schema.sql]]` | A file relative to the project root |
| Repository directory | `[[src/components]]` | A directory relative to the project root |
| Function | `[[src/auth.ts#rotateToken]]` | A named function in a supported source file |
| Class method | `[[src/server.ts#Server#listen]]` | The `listen` method on the `Server` class |
| External section | `[[sdk:docs/auth.md#Tokens]]` | A section in the configured `sdk` external source |
| Section referenced from code | `// @lat: [[auth#Tokens#Rotation]]` | A source comment connecting code to its documented intent |

[[external_sources|External sources]] extend links to documentation and code in other repositories.

Ordinary Markdown links also work; Lat checks local file and image destinations, Markdown heading fragments, and reference-style link definitions.

## Supported languages

Lat supports source-symbol links and code references in the following languages, so you can connect explanations to named definitions and follow references back from code.

- **C:** `.c`, `.h`
- **Dart:** `.dart`
- **Go:** `.go`
- **Java:** `.java`
- **JavaScript:** `.js`, `.jsx`
- **PHP:** `.php`
- **Python:** `.py`
- **Rust:** `.rs`
- **Swift:** `.swift`
- **TypeScript:** `.ts`, `.tsx`

For these files, `lat check` verifies that linked symbols exist, and Lat UI can navigate to their definitions. Lat also discovers `@lat:` comments that connect code to documented sections.

You can still link to files in other languages or formats by their repository path, but source-symbol navigation and code-reference discovery require a supported extension. The [[packages/core/src/source-formats.ts#SOURCE_FILE_EXTENSIONS|source-format registry]] defines the supported extensions.

## Code references and test specs

An `@lat:` comment points from code to the section that explains its intent. Lat can then show which implementations or tests refer to that knowledge.

For a project documenting refresh-token rotation:

```ts
// @lat: [[auth#Tokens#Rotation]]
export function rotateToken() {}
```

To require code references for a document, add `lat.require-code-mention: true` in YAML frontmatter at the top of the file. This is useful for test specs and requirements that must be traceable to code. For example, `lat.md/auth-tests.md` could contain:

```md
---
lat:
  require-code-mention: true
---

# Authentication tests

These tests verify that token rotation prevents reuse of old credentials.

## Rejects a reused refresh token

A refresh token that has already been exchanged cannot create another session.
```

Each leaf section—a section with no subsections—must then have a corresponding code reference. Place it next to the test or implementation that covers the requirement:

```ts
// @lat: [[auth-tests#Authentication tests#Rejects a reused refresh token]]
test('rejects a reused refresh token', async () => {
  // Exercise token reuse and assert that it is rejected.
});
```

`lat check` reports required sections without code references and references whose targets no longer exist. It verifies the connection, not whether the test proves the documented behavior. See [[markdown#Frontmatter#require-code-mention|required code mentions]] for the rule.

## What Lat checks

`lat check` catches broken connections and structural drift as your project evolves, helping keep its knowledge navigable and connected to code.

- **Links still lead somewhere.** References between documents, into source symbols, and to external sources resolve. Local file and image links have valid destinations.
- **Knowledge stays connected to implementation.** References from code point to existing sections, and test specs or requirements marked as requiring code references have them.
- **Documents remain easy to navigate.** Sections start with concise explanations, and directory indexes keep up with added, moved, or removed pages.
- **Diagrams stay manageable.** Mermaid diagrams are checked for syntax errors, overly large flowcharts, and labels estimated to become too small to read.

Run `lat check` after editing knowledge or changing the code it references. It catches issues such as a link to a renamed function or a test spec that lost its code reference. People and agents still need to review whether the explanations and tests accurately describe the intended behavior.

## Find relevant knowledge

Search in natural language when you know the topic but not the section name.

```bash
lat search "how do refresh tokens work?"
```

Use `lat locate` to find a section by name, `lat section` to read it, and `lat refs` to find what references it.

## Tooling

Use Lat through the CLI, your coding agent, or the browser, depending on whether you want to automate a task, work with project context, or explore the graph visually.

- **CLI:** Search, read, and validate knowledge from your terminal or scripts. The [[commands]] reference lists the commands and their purposes.
- **Agent integrations:** Let coding agents retrieve context and maintain the graph through CLI commands or Model Context Protocol (MCP) tools. Start with [[quick-start]], then follow [[lat-workflow]] for everyday use.
- **Lat UI:** Browse documents, follow links into source code, and explore the graph. The [[ui]] guide covers local browsing and publishing a static or searchable site.

Continue to [[commands]] to choose a command for your next task.
