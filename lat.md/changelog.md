# Changelog

Features, behavior changes, and bug fixes for each Lat release, newest first. Patch releases have their own entries; unreleased changes describe functionality already implemented on this branch.

## 0.13.0 — Unreleased

Lat adds a browser and publishing tools, pinned upstream references, hybrid search, and a lightweight checker for CI.

### Features: browser and editing

[[ui|Lat UI]] makes the knowledge graph navigable alongside source code, validation results, and local changes.

- Added a live browser with file navigation, section TOC, source previews, and graph exploration; `lat ui` and `lat ui run` open it. [#92](https://github.com/vercel-labs/lat.md/pull/92) [#94](https://github.com/vercel-labs/lat.md/pull/94) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added mobile navigation, a collapsible TOC, active-section and subtree indicators, and sidebar ordering from directory index documents. [#95](https://github.com/vercel-labs/lat.md/pull/95) [#141](https://github.com/vercel-labs/lat.md/pull/141) [#147](https://github.com/vercel-labs/lat.md/pull/147)
- Added Git change highlighting and validation indicators; `--no-git` disables Git integration. [#92](https://github.com/vercel-labs/lat.md/pull/92) [#94](https://github.com/vercel-labs/lat.md/pull/94) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added section menus for backlinks, copying links or IDs, section output, and raw Markdown. [#104](https://github.com/vercel-labs/lat.md/pull/104) [#139](https://github.com/vercel-labs/lat.md/pull/139)
- Added conflict-aware Markdown editing with CodeMirror: saves merge independent disk edits and report conflicts. [#117](https://github.com/vercel-labs/lat.md/pull/117)
- Added GitHub-flavored Markdown, tables, task lists, highlighting for all bundled Highlight.js languages and aliases, math, Mermaid diagrams, interactive maps, and STL previews. [#103](https://github.com/vercel-labs/lat.md/pull/103) [#185](https://github.com/vercel-labs/lat.md/pull/185)
- Added code-block copy buttons that preserve whitespace and report clipboard failures. [#143](https://github.com/vercel-labs/lat.md/pull/143)
- Added extensionless document URLs at the site root, with raw Markdown served separately. [#119](https://github.com/vercel-labs/lat.md/pull/119) [#146](https://github.com/vercel-labs/lat.md/pull/146)
- Refined graph styling and reduced wheel-zoom speed for finer camera control. [#145](https://github.com/vercel-labs/lat.md/pull/145) [#148](https://github.com/vercel-labs/lat.md/pull/148) [#158](https://github.com/vercel-labs/lat.md/pull/158)
- Added linked vault resources and hosted documentation badges to rendered pages. [#124](https://github.com/vercel-labs/lat.md/pull/124) [#137](https://github.com/vercel-labs/lat.md/pull/137)

- Added TOC navigation that prioritizes explicit section choices over search-passage positioning, including repeated clicks on the current fragment. [#182](https://github.com/vercel-labs/lat.md/pull/182)
- Added live updates with background stream cleanup and external previews that ignore their own cache writes. [#114](https://github.com/vercel-labs/lat.md/pull/114) [#160](https://github.com/vercel-labs/lat.md/pull/160)
- Added source previews for ordinary Markdown links to repository text files. [#161](https://github.com/vercel-labs/lat.md/pull/161)
- Supported multiline HTML labels in Mermaid diagrams and Git diff styling around diagrams and rich fences. [#157](https://github.com/vercel-labs/lat.md/pull/157) [#159](https://github.com/vercel-labs/lat.md/pull/159)
- Added separate addition/removal styling for replaced Markdown list items. [#129](https://github.com/vercel-labs/lat.md/pull/129)
- Adapted code blocks and TOC layout for mobile screens, kept source badges with wrapped labels, and omitted external-link icons on linked images. [#97](https://github.com/vercel-labs/lat.md/pull/97) [#98](https://github.com/vercel-labs/lat.md/pull/98) [#121](https://github.com/vercel-labs/lat.md/pull/121)
- Validated live UI hosts and origins and isolated linked resources from the application origin. [#180](https://github.com/vercel-labs/lat.md/pull/180)

### Features: publishing

Publish the same graph as a static site or a portable server with search, using [[ui#Publish|Lat UI build commands]].

- Added static export with documents, source previews, backlinks, graph navigation, and resources, exposed as `lat ui build static`. [#94](https://github.com/vercel-labs/lat.md/pull/94) [#124](https://github.com/vercel-labs/lat.md/pull/124) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added `lat ui build server` with static pages, a build-time search index, and a portable Express app using the shared `@lat.md/server` runtime. [#127](https://github.com/vercel-labs/lat.md/pull/127) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added `--target vercel` to package static content and the search runtime as Vercel Build Output API artifacts. [#135](https://github.com/vercel-labs/lat.md/pull/135)

- Enforced export boundaries so published artifacts include intended content and referenced resources without exposing unrelated project files. [#181](https://github.com/vercel-labs/lat.md/pull/181)
- Deployed server search opens its bundled database directly and requires a writable database directory. [#174](https://github.com/vercel-labs/lat.md/pull/174)

### Features: external sources and source links

[[external_sources|External sources]] extend the graph to pinned upstream documentation and code.

- Added `lat external add`, `list`, and `show` for commit-pinned upstream sources, with individual-file retrieval, managed Git checkouts, and verified local overrides.
- Added external Markdown, reStructuredText, AsciiDoc, and source-symbol targets to validation, lookup, backlinks, previews, and exports. [865a932](https://github.com/vercel-labs/lat.md/commit/865a932ba9215d66a41e2866d0c2a8cdc64bdeaf)
- Rendered external reStructuredText and AsciiDoc through native syntax trees, with unavailable-link handling and stale-cache-lock recovery. [#108](https://github.com/vercel-labs/lat.md/pull/108)
- Added wiki links to arbitrary repository files and directories, including formats without a source parser. [#116](https://github.com/vercel-labs/lat.md/pull/116)
- Added Dart, Java, and PHP declarations to source links and code-reference validation. [#109](https://github.com/vercel-labs/lat.md/pull/109) [#110](https://github.com/vercel-labs/lat.md/pull/110) [#165](https://github.com/vercel-labs/lat.md/pull/165)
- Added Swift source links for declarations, nested types, extension members, and enum cases, with validation, code-reference scanning, and highlighted previews. [#186](https://github.com/vercel-labs/lat.md/pull/186)
- Improved section reference output with linked definitions and reference context. [#105](https://github.com/vercel-labs/lat.md/pull/105)

### Features: search

Hybrid retrieval combines semantic similarity with full-text matching and shows the passages behind each result. See [[rag-architecture#RAG Architecture|RAG architecture]] for details.

- Added passage-based indexing of complete section bodies, combining semantic and stemmed full-text rankings while reusing embeddings for unchanged passages. [#150](https://github.com/vercel-labs/lat.md/pull/150) [#151](https://github.com/vercel-labs/lat.md/pull/151)
- Added passage evidence, line ranges, expandable previews, destination highlights, and semantic/lexical score details to browser search results. [#152](https://github.com/vercel-labs/lat.md/pull/152)
- Added `lat search --debug` to show similarity scores and configurable thresholds to filter search results. [#113](https://github.com/vercel-labs/lat.md/pull/113)
- Replaced the previous cache with a local Turso index published through a single `search.db` file. [#151](https://github.com/vercel-labs/lat.md/pull/151) [#168](https://github.com/vercel-labs/lat.md/pull/168)

### Features: validation, setup, and CI

Validation gains broader coverage and reusable caches, while setup supports lighter automated checks.

- Added `lat check links` for ordinary Markdown links, images, and missing reference-link definitions; accepted GitHub-style heading fragments and explicit check directories via `-- <directory>`. [#88](https://github.com/vercel-labs/lat.md/pull/88)
- Accelerated checks with persistent parsed-file caches, concurrent discovery, and lazy parser loading, with cache and import diagnostics in profiles. [#106](https://github.com/vercel-labs/lat.md/pull/106) [#107](https://github.com/vercel-labs/lat.md/pull/107)
- Added `lat check --profile` for nested timings and slow-input reporting. [865a932](https://github.com/vercel-labs/lat.md/commit/865a932ba9215d66a41e2866d0c2a8cdc64bdeaf)
- Simplified check output and used the tracked-file inventory for source discovery. [#111](https://github.com/vercel-labs/lat.md/pull/111) [#126](https://github.com/vercel-labs/lat.md/pull/126)
- Added `@lat.md/core` and `lat-core` for checks without search or UI dependencies, plus a portable GitHub check action; the full package still exposes `lat`. [#171](https://github.com/vercel-labs/lat.md/pull/171)
- Added `lat paths` for storage and configuration paths, with `--config` for configuration-only output; `lat config` remains a hidden compatibility alias. [#175](https://github.com/vercel-labs/lat.md/pull/175)
- Made fresh initialization prefer local embeddings without hosted credentials.
- Remembered interactive agent selections in ignored local configuration. [#142](https://github.com/vercel-labs/lat.md/pull/142)
- Added Codex lifecycle hooks for context retrieval and end-of-task checks.
- Included untracked source and documentation files in stop-hook change analysis. [#115](https://github.com/vercel-labs/lat.md/pull/115)
- Switched CLI, library, and UI builds to the native Go-based TypeScript compiler, using prebuilt binaries without requiring Go. [#176](https://github.com/vercel-labs/lat.md/pull/176)

### Bug fixes: indexing and integration

Search rebuilds and generated agent commands now handle failures and concurrent work more reliably.

- Fixed duplicate or formatted headings crashing reindexing, and removed full-text scoring drift after document edits. [#154](https://github.com/vercel-labs/lat.md/pull/154) [#167](https://github.com/vercel-labs/lat.md/pull/167)
- Made index publication atomic and serialized concurrent writers with OS locks released on exit or process death, preserving the previous index after failed rebuilds. [#168](https://github.com/vercel-labs/lat.md/pull/168) [#169](https://github.com/vercel-labs/lat.md/pull/169)
- Fixed indexing crashes when logos or introductory text precede the first heading; indexing skips that preamble and keeps the following sections searchable. [#184](https://github.com/vercel-labs/lat.md/pull/184)
- Replaced per-reader database copies with scoped access locks. [#174](https://github.com/vercel-labs/lat.md/pull/174)
- Fixed local Node hooks to retain their executable and invocation arguments.
- Improved managed external Git cache handling on Windows. [#173](https://github.com/vercel-labs/lat.md/pull/173)

### Security fixes

Repository-controlled paths, content, and configuration receive stricter boundaries during checking, setup, and publishing.

- Prevented shell evaluation of queries and paths passed through generated agent tools. [#177](https://github.com/vercel-labs/lat.md/pull/177)
- Confined source-reference reads to allowed project files and hardened reference parsing against unsafe paths. [#178](https://github.com/vercel-labs/lat.md/pull/178)
- Confined initialization writes to the project, including symlinked paths. [#179](https://github.com/vercel-labs/lat.md/pull/179)
- Prevented cache cleanup from following symlinks outside the project and moved managed Git caches outside checkouts to avoid trusting repository-planted Git configuration. [#173](https://github.com/vercel-labs/lat.md/pull/173)

---

## 0.12.2

Windows source-code reference validation now resolves paths consistently with other platforms.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.12.2) · [PR #84](https://github.com/vercel-labs/lat.md/pull/84)

- Normalized authored Windows paths for code-reference validation and exact `lat locate` lookup, while preserving heading text after the first `#`. [#83](https://github.com/vercel-labs/lat.md/pull/83)

## 0.12.1

Lat gains Windows support across CLI paths, tooling, and continuous integration.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.12.1) · [PR #78](https://github.com/vercel-labs/lat.md/pull/78)

- Normalized section paths across Windows and Unix, added Windows CI, and fixed platform-specific test timeouts and database file-lock cleanup failures. [#77](https://github.com/vercel-labs/lat.md/pull/77)

## 0.12.0

Semantic search becomes offline-first with a bundled local embedding engine and an explicit index-rebuild command.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.12.0) · [PR #76](https://github.com/vercel-labs/lat.md/pull/76)

### Features and improvements

Local search no longer requires a hosted API key or a network connection.

- Bundled a Rust/WASM embedding engine and model for offline search, with worker-thread parallelism and reduced batch-padding overhead. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Added `lat reindex` to replace `lat search --reindex`, with backend selection, a durable local preference, a `--remote` override, and progress driven by completed work. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Made queries use the backend recorded in the index, preventing credential changes from silently switching models. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Added multi-select agent setup, marker-based instruction updates that preserve user-authored content, and actionable next steps. [#39](https://github.com/vercel-labs/lat.md/pull/39)
- Added a repository workflow for `lat check` in GitHub Actions. [#48](https://github.com/vercel-labs/lat.md/pull/48)

### Bug fixes

Index rebuilds handle bad credentials, legacy caches, and worker failures more safely.

- Handled invalid credentials, rebuilt legacy caches lacking model metadata, reported worker crashes, and cleaned up failed index builds; backend preferences are saved only after successful builds. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Made prompt hooks read-only so retrieving context cannot trigger index rebuilds. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Removed `wasm-opt` from the embedding build to fix a `WebAssembly.Table.grow` failure in CI. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Replaced this repository’s linked agent instruction files with copies to prevent recursive instruction discovery. [#49](https://github.com/vercel-labs/lat.md/pull/49)

---

## 0.11.0

Agent setup expands to Codex and OpenCode, and C links can target fields and enum values.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.11.0) · [PR #38](https://github.com/vercel-labs/lat.md/pull/38)

- Added Codex MCP setup, OpenCode plugin-registered tools, and Cursor stop hooks for end-of-task validation.
- Added C struct-field and enum-value links, including qualified targets and fields inside anonymous structs and unions.

---

## 0.10.4

Section output identifies the complete line range of referenced source definitions.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.10.4) · [PR #37](https://github.com/vercel-labs/lat.md/pull/37)

- Added complete source-definition line ranges to `lat section` output, such as `file.ts:10-25`.

## 0.10.3

C source links recognize declarations inside additional language and preprocessor constructs.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.10.3) · [PR #35](https://github.com/vercel-labs/lat.md/pull/35)

- Fixed C declaration lookup inside preprocessor conditionals and `extern "C"` blocks, including pointer typedefs and function declarations.

## 0.10.2

Source parsing uses memory more reliably and recognizes more C declarations.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.10.2) · [PR #34](https://github.com/vercel-labs/lat.md/pull/34)

- Fixed a tree-sitter WASM memory leak and cached parsed source symbols to avoid reparsing unchanged files.
- Fixed missing C pointer-returning functions, function-like macros, and array variables.

## 0.10.1

Python source links correctly identify decorated declarations.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.10.1) · [PR #33](https://github.com/vercel-labs/lat.md/pull/33)

- Fixed source-symbol lookup for decorated Python functions, classes, and methods, including code-reference comments between decorators and declarations.

## 0.10.0

Reference discovery becomes faster, and section output includes more useful source context.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.10.0) · [PR #30](https://github.com/vercel-labs/lat.md/pull/30)

### Features and improvements

Readers can follow documentation-to-code relationships without opening every source file manually.

- Added source-file reference queries, code backlinks, and outgoing definition snippets in `lat section`; `lat refs` now includes Markdown and code by default.
- Added ripgrep-backed discovery with a TypeScript fallback, check timing, and ripgrep installation suggestions; exercised both scanners in CI. [#26](https://github.com/vercel-labs/lat.md/pull/26)
- Rendered Pi tool results and custom Lat messages as styled Markdown.

### Bug fixes

Reference paths and fallback selection now behave consistently.

- Made code-reference paths project-relative and fixed the ripgrep-disable override to activate only for its explicit enabled value.

---

## 0.9.0

Agent initialization installs reusable guidance for maintaining Lat documentation.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.9.0) · [PR #25](https://github.com/vercel-labs/lat.md/pull/25)

- Added the `lat-md` authoring skill to initialization for supported agents and clarified the setup menu’s continuation action.

---

## 0.8.2

Initialization makes command invocation explicit and checks setup prerequisites more consistently.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.8.2) · [PR #24](https://github.com/vercel-labs/lat.md/pull/24)

### Features and improvements

Users can choose how generated integrations invoke Lat.

- Added a global, local, or `npx` command-style choice and an upfront check for a newer Lat version on npm during initialization.

### Bug fixes

Setup respects existing configuration and tracked files.

- Made setup recognize keys supplied through `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER`, and stopped ignoring integration files already tracked by Git.

## 0.8.1

Interactive initialization no longer crashes when successive prompts share standard input.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.8.1) · [PR #23](https://github.com/vercel-labs/lat.md/pull/23)

- Fixed initialization crashing when readline and selection menus share stdin.

## 0.8.0

Pi integration and interactive agent selection simplify onboarding.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.8.0) · [PR #22](https://github.com/vercel-labs/lat.md/pull/22)

### Features and improvements

The Pi extension exposes Lat tools and makes their activity visible in the agent interface.

- Added Pi tools and lifecycle messages, with inline queries, collapsible search and section results, and custom reminder and validation rendering.
- Replaced separate yes/no agent prompts with an arrow-key selection menu.

### Bug fixes

Agent hooks and development installs handle their invocation and event formats correctly.

- Fixed Pi lifecycle message shapes and invocation of TypeScript entry points in development installations.
- Reduced stop-hook false positives and hardened detection of existing hooks.

---

## 0.7.2

Section output includes descendants, and stop hooks block only when follow-up work is needed.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.7.2) · [PR #21](https://github.com/vercel-labs/lat.md/pull/21)

- Included subsections in `lat section` output and limited stop-hook blocking to validation failures or out-of-sync documentation.

## 0.7.1

CLI output becomes easier to scan, and YAML frontmatter is parsed correctly.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.7.1) · [PR #18](https://github.com/vercel-labs/lat.md/pull/18)

- Added Markdown headings, blockquotes, and navigation hints to command output, and fixed YAML frontmatter parsing.

## 0.7.0

Section retrieval, more source languages, and versioned initialization broaden Lat's agent workflow.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.7.0) · [PR #17](https://github.com/vercel-labs/lat.md/pull/17)

### Features and improvements

New commands expose full context and validate the structure that makes it useful.

- Added `lat section` and its MCP tool, renamed `lat prompt` to `lat expand`, and added hook reference expansion and search navigation hints.
- Added Rust, Go, and C source links, including Rust implementation methods, Go methods, and declarations in `.c` and `.h` files.
- Added `lat check sections` to require concise leading paragraphs beneath headings.
- Added init versions, generated-file hashes, automatic refreshes, overwrite prompts for user edits, and hook synchronization; replaced the shell hook with a native command that directs agents to search before work.

### Bug fixes

Validation and setup report invalid inputs instead of hiding failures.

- Reported corrupt configuration, unreadable source files, and unsupported source extensions; flagged non-Markdown vault files under this release’s validation rules.
- Improved initialization input validation and existing-hook detection.

---

## 0.6.0

Wiki links can target source-code symbols as well as documentation sections.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.6.0) · [PR #16](https://github.com/vercel-labs/lat.md/pull/16)

- Added project-root-relative source links for JavaScript, TypeScript, and Python declarations and class members; canonical section IDs gained the `lat.md/` prefix while short references stayed compatible.

---

## 0.5.0

Initialization guidance and canonical section IDs make project setup and links more predictable.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.5.0) · [PR #15](https://github.com/vercel-labs/lat.md/pull/15)

- Suggested `lat init` when no vault exists, and changed directory index entries to wiki links for graph navigation and validation.
- Fixed canonical section IDs to include the root H1 heading instead of dropping it from section paths.

---

## 0.4.3

Long-running MCP sessions see filesystem changes instead of returning stale sections and references.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.4.3) · [PR #14](https://github.com/vercel-labs/lat.md/pull/14)

- Removed module-level file-walker and section caches that persisted across MCP calls, so subsequent requests read updated project content.

## 0.4.2

VS Code recognizes the MCP server configuration generated by initialization.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.4.2) · [PR #13](https://github.com/vercel-labs/lat.md/pull/13)

- Fixed VS Code MCP setup to use the top-level `servers` key, while preserving `mcpServers` for Claude Code and Cursor. [#12](https://github.com/vercel-labs/lat.md/pull/12)

## 0.4.1

Embedding credentials can come from a file or helper command instead of a directly configured key.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.4.1) · [PR #11](https://github.com/vercel-labs/lat.md/pull/11)

- Added `LAT_LLM_KEY_FILE` and `LAT_LLM_KEY_HELPER`; resolution prefers `LAT_LLM_KEY`, then the key file, helper command, and user configuration, in that order.
- Added `lat config` to print the configuration-file path and updated diagnostics to describe all credential sources.

## 0.4.0

An MCP server and per-agent setup connect Lat to more coding tools, with persistent user-level embedding credentials.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.4.0) · [PR #9](https://github.com/vercel-labs/lat.md/pull/9)

- Added `lat mcp`, exposing locate, search, prompt expansion, checking, and reference lookup over stdio.
- Added per-agent initialization for Claude Code, Cursor, VS Code Copilot, and Codex/OpenCode, with dedicated instructions, MCP configuration, and activation guidance.
- Added an XDG user configuration file and interactive embedding-key setup, removing the need to configure an environment variable for every session.
- Standardized provider messages on “Vercel AI Gateway.”

---

## 0.3.0

Section discovery distinguishes exact and approximate matches, and Claude Code can retrieve context on each prompt.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.3.0) · [PR #6](https://github.com/vercel-labs/lat.md/pull/6)

- Added tiered section matching with exact, file-stem/subsection, and fuzzy lookup; CLI output identifies match reasons and prompt expansion reports confidence.
- Tightened wiki-link validation to reject bare headings, local heading-only targets, and skipped intermediate headings rather than silently accepting ambiguous links.
- Made `lat init` install a Claude Code prompt hook that directs the agent to consult the graph through `lat search` and `lat prompt`.

---

## 0.2.3

The first 0.2 package currently listed on npm adds nested vaults, short references, and directory-index checks.

[Release notes](https://github.com/vercel-labs/lat.md/releases/tag/v0.2.3) · [PR #5](https://github.com/vercel-labs/lat.md/pull/5)

The 0.2.0–0.2.2 PRs record earlier iterations of these features and publishing fixes, but those versions are absent from npm. The official 0.2.3 notes summarize the series. [#2](https://github.com/vercel-labs/lat.md/pull/2) [#3](https://github.com/vercel-labs/lat.md/pull/3) [#4](https://github.com/vercel-labs/lat.md/pull/4)

### Features and improvements

Nested knowledge directories remain addressable and discoverable through validated indexes.

- Added subdirectory support with vault-relative section IDs and Obsidian-style short references; ambiguous file stems report candidate paths.
- Added `lat check index` to require a same-named index file listing each directory’s contents with bullet points.
- Unified file walking with `.gitignore` handling and filesystem memoization, and formatted validation errors as Markdown-style bullets with indented context.

### Publishing fixes

Automated releases use npm trusted publishing without a stored npm token.

- Added the publishing workflow and fixed OIDC authentication by upgrading npm and removing conflicting registry configuration. [#5](https://github.com/vercel-labs/lat.md/pull/5)

---

## 0.1.4

Generated agent guidance explains that test-spec sections need meaningful descriptions.

- Added descriptions to generated test-spec examples and explicitly prohibited empty heading-only sections. [fe91836](https://github.com/vercel-labs/lat.md/commit/fe91836ec6eb4e3b80031270d616500d743b83af)

## 0.1.3

CLI startup is quieter, and generated instructions make test-spec backlinks more precise.

- Suppressed transitive dependency deprecation warnings and required one nearby code-reference comment per test specification in agent guidance. [1f0cc84](https://github.com/vercel-labs/lat.md/commit/1f0cc84d649b56509288e2308d707be79f5a46b6)

## 0.1.2

Generated instructions establish a before-work context lookup and an after-work documentation and validation checklist.

- Added explicit search and prompt-expansion steps, required documentation updates and `lat check`, and explained API-key setup and test-spec coverage. [e386d64](https://github.com/vercel-labs/lat.md/commit/e386d644606e14c9050cbd90c1d4c518e290a695)

## 0.1.1

Lat gains validation, semantic search, prompt expansion, and project initialization beyond the original lookup commands.

- Added `lat check` for wiki links, source-code mentions, and required test-spec backlinks, including Python comments.
- Added hosted semantic search through `lat search`, with result limits and index rebuilding.
- Added `lat prompt` to expand references into section context from an argument or stdin, and improved fuzzy section and reference lookup.
- Added `lat init` and `lat gen` for vault scaffolding and agent instructions, plus global project-directory and color controls. [2bcea2f](https://github.com/vercel-labs/lat.md/commit/2bcea2f70fdb122c4b6a6132f0ea5befde006eef)

## 0.1.0

The initial published CLI finds Markdown sections and their incoming references.

- Added `lat locate` for section lookup and `lat refs` with Markdown, code, or combined reference scopes. [7504423](https://github.com/vercel-labs/lat.md/commit/750442318d3b984945170c3f9350142a1b2b3ed9)
