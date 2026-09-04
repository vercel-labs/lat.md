# Commands

Use the `lat` CLI to validate project knowledge, find context, inspect references, and publish a site.

For installation and agent setup, follow [[quick-start]]. Angle brackets below mark required arguments; square brackets mark optional ones.

| Command | Purpose |
| --- | --- |
| `lat init [dir]` | Set up the project's `lat.md/` directory and coding agents |
| `lat check` | Validate links, section structure, and code references |
| `lat search <query>` | Find sections using natural language |
| `lat locate <query>` | Find a section by exact or fuzzy name |
| `lat section <target>` | Read a section and its incoming and outgoing references |
| `lat refs <target>` | Find Markdown and code that reference a target |
| `lat expand <text>` | Resolve wiki links in a prompt and include their content |
| `lat reindex` | Rebuild the search index or switch embedding backends |
| `lat external add`, `list`, `show` | Configure and inspect [[upstream]] |
| `lat ui` | Open the local [[browser]]; `lat ui run` is equivalent |
| `lat ui build static [output]` | Publish a read-only site without search |
| `lat ui build server [output]` | Publish a site with search; `--target` selects `node` or `vercel` |
| `lat mcp` | Serve tools over Model Context Protocol (MCP) for agents |
| `lat gen <target>` | Print an agent integration template |
| `lat paths` | Show external paths and their purpose; `--config` shows the configuration path |

Run `lat <command> --help` for arguments and options. Quote arguments containing spaces, such as `lat search "refresh token rotation"`.

Use `lat check --profile` to inspect validation timing and `lat search --debug` to show result scores. Commands that accept section targets support short names and full section ids; see [[concepts#Vault and sections|section addressing]].
