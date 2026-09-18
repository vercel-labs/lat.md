# Changelog

Features, behavior changes, and bug fixes for each Lat release, newest first. Patch releases have their own entries; unreleased changes describe functionality already implemented on this branch.

## 0.13.0 — Unreleased

Lat adds a browser and publishing tools, pinned upstream references, hybrid search, and a lightweight checker for CI.

### Features: browser and editing

[[browser|Lat UI]] makes the knowledge graph navigable alongside source code, validation results, and local changes.

- Added a live browser with file navigation, section TOC, source previews, and graph exploration; `lat ui` and `lat ui run` open it. [#92](https://github.com/vercel-labs/lat.md/pull/92) [#94](https://github.com/vercel-labs/lat.md/pull/94) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added mobile navigation, a collapsible TOC, active-section and subtree indicators, and sidebar ordering from directory index documents. [#95](https://github.com/vercel-labs/lat.md/pull/95) [#141](https://github.com/vercel-labs/lat.md/pull/141) [#147](https://github.com/vercel-labs/lat.md/pull/147)
- Added Git change highlighting and validation indicators; `--no-git` disables Git integration. [#92](https://github.com/vercel-labs/lat.md/pull/92) [#94](https://github.com/vercel-labs/lat.md/pull/94) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added section menus for backlinks, copying links or IDs, section output, and raw Markdown. [#104](https://github.com/vercel-labs/lat.md/pull/104) [#139](https://github.com/vercel-labs/lat.md/pull/139)
- Added conflict-aware Markdown editing with CodeMirror: saves merge independent disk edits and report conflicts. [#117](https://github.com/vercel-labs/lat.md/pull/117)
- Added GitHub-flavored Markdown, tables, task lists, code highlighting, math, Mermaid diagrams, interactive maps, and STL previews. [#103](https://github.com/vercel-labs/lat.md/pull/103)
- Added code-block copy buttons that preserve whitespace and report clipboard failures. [#143](https://github.com/vercel-labs/lat.md/pull/143)
- Added extensionless document URLs at the site root, with raw Markdown served separately. [#119](https://github.com/vercel-labs/lat.md/pull/119) [#146](https://github.com/vercel-labs/lat.md/pull/146)
- Refined graph styling and reduced wheel-zoom speed for finer camera control. [#145](https://github.com/vercel-labs/lat.md/pull/145) [#148](https://github.com/vercel-labs/lat.md/pull/148) [#158](https://github.com/vercel-labs/lat.md/pull/158)
- Added linked vault resources and hosted documentation badges to rendered pages. [#124](https://github.com/vercel-labs/lat.md/pull/124) [#137](https://github.com/vercel-labs/lat.md/pull/137)

### Features: publishing

Publish the same graph as a static site or a portable server with search, using [[browser#Publish|Lat UI build commands]].

- Added static export with documents, source previews, backlinks, graph navigation, and resources, exposed as `lat ui build static`. [#94](https://github.com/vercel-labs/lat.md/pull/94) [#124](https://github.com/vercel-labs/lat.md/pull/124) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added `lat ui build server` with static pages, a build-time search index, and a portable Express app using the shared `@lat.md/server` runtime. [#127](https://github.com/vercel-labs/lat.md/pull/127) [#132](https://github.com/vercel-labs/lat.md/pull/132)
- Added `--target vercel` to package static content and the search runtime as Vercel Build Output API artifacts. [#135](https://github.com/vercel-labs/lat.md/pull/135)

### Features: external sources and source links

[[upstream|External sources]] extend the graph to pinned upstream documentation and code.

- Added `lat external add`, `list`, and `show` for commit-pinned upstream sources, with individual-file retrieval, managed Git checkouts, and verified local overrides.
- Added external Markdown, reStructuredText, AsciiDoc, and source-symbol targets to validation, lookup, backlinks, previews, and exports. [865a932](https://github.com/vercel-labs/lat.md/commit/865a932ba9215d66a41e2866d0c2a8cdc64bdeaf)
- Rendered external reStructuredText and AsciiDoc through native syntax trees, with unavailable-link handling and stale-cache-lock recovery. [#108](https://github.com/vercel-labs/lat.md/pull/108)
- Added wiki links to arbitrary repository files and directories, including formats without a source parser. [#116](https://github.com/vercel-labs/lat.md/pull/116)
- Added Dart, Java, and PHP declarations to source links and code-reference validation. [#109](https://github.com/vercel-labs/lat.md/pull/109) [#110](https://github.com/vercel-labs/lat.md/pull/110) [#165](https://github.com/vercel-labs/lat.md/pull/165)
- Improved section reference output with linked definitions and reference context. [#105](https://github.com/vercel-labs/lat.md/pull/105)

### Features: search

Hybrid retrieval combines semantic similarity with full-text matching and shows the passages behind each result.

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

### Bug fixes: navigation and rendering

These fixes keep browser navigation responsive and preserve document meaning during rendering.

- Fixed TOC navigation from search results and repeated clicks on the current fragment, so explicit section choices override search-passage positioning. [#182](https://github.com/vercel-labs/lat.md/pull/182)
- Released background event streams to prevent stalled navigation, and stopped external previews restarting on their own cache writes. [#114](https://github.com/vercel-labs/lat.md/pull/114) [#160](https://github.com/vercel-labs/lat.md/pull/160)
- Fixed ordinary Markdown links to repository text files opening as vault resources instead of source previews. [#161](https://github.com/vercel-labs/lat.md/pull/161)
- Fixed multiline HTML labels in Mermaid diagrams and preserved Git diff styling around rendered diagrams and rich fences. [#157](https://github.com/vercel-labs/lat.md/pull/157) [#159](https://github.com/vercel-labs/lat.md/pull/159)
- Fixed replaced Markdown list items losing addition/removal styling or merging old and new text into one bullet. [#129](https://github.com/vercel-labs/lat.md/pull/129)
- Fixed mobile code overflow and TOC layout, kept source badges with wrapped labels, and removed external-link icons from linked images. [#97](https://github.com/vercel-labs/lat.md/pull/97) [#98](https://github.com/vercel-labs/lat.md/pull/98) [#121](https://github.com/vercel-labs/lat.md/pull/121)

### Bug fixes: indexing and integration

Search rebuilds and generated agent commands now handle failures and concurrent work more reliably.

- Fixed duplicate or formatted headings crashing reindexing, and removed full-text scoring drift after document edits. [#154](https://github.com/vercel-labs/lat.md/pull/154) [#167](https://github.com/vercel-labs/lat.md/pull/167)
- Made index publication atomic and serialized concurrent writers with OS locks released on exit or process death, preserving the previous index after failed rebuilds. [#168](https://github.com/vercel-labs/lat.md/pull/168) [#169](https://github.com/vercel-labs/lat.md/pull/169)
- Replaced per-reader database copies with scoped access locks; deployed UI search now opens its bundled database directly and requires a writable database directory. [#174](https://github.com/vercel-labs/lat.md/pull/174)
- Fixed local Node hooks to retain their executable and invocation arguments.
- Improved managed external Git cache handling on Windows. [#173](https://github.com/vercel-labs/lat.md/pull/173)

### Security fixes

Repository-controlled paths, content, and configuration receive stricter boundaries during checking, setup, and publishing.

- Prevented shell evaluation of queries and paths passed through generated agent tools. [#177](https://github.com/vercel-labs/lat.md/pull/177)
- Confined source-reference reads to allowed project files and hardened reference parsing against unsafe paths. [#178](https://github.com/vercel-labs/lat.md/pull/178)
- Validated live UI hosts and origins and isolated linked resources from the application origin. [#180](https://github.com/vercel-labs/lat.md/pull/180)
- Confined initialization writes to the project, including symlinked paths. [#179](https://github.com/vercel-labs/lat.md/pull/179)
- Prevented cache cleanup from following symlinks outside the project and moved managed Git caches outside checkouts to avoid trusting repository-planted Git configuration. [#173](https://github.com/vercel-labs/lat.md/pull/173)
- Enforced export boundaries so published artifacts include intended content and referenced resources without exposing unrelated project files. [#181](https://github.com/vercel-labs/lat.md/pull/181)

---

## 0.12.2

Windows source-code reference validation now resolves paths consistently with other platforms. [Release #84](https://github.com/vercel-labs/lat.md/pull/84)

- Fixed Windows code-reference path resolution so valid references resolve consistently across platforms. [#83](https://github.com/vercel-labs/lat.md/pull/83)

## 0.12.1

Lat gains Windows support across CLI paths, tooling, and continuous integration. [Release #78](https://github.com/vercel-labs/lat.md/pull/78)

- Normalized section paths across Windows and Unix, added Windows CI, and fixed platform-specific test timeouts and database file-lock cleanup failures. [#77](https://github.com/vercel-labs/lat.md/pull/77)

## 0.12.0

Semantic search becomes offline-first with a bundled local embedding engine and an explicit index-rebuild command. [Release #76](https://github.com/vercel-labs/lat.md/pull/76)

### Features and improvements

Local search no longer requires a hosted API key or a network connection.

- Bundled a Rust/WASM embedding engine and model for offline search, with worker-thread parallelism and reduced batch-padding overhead. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Added `lat reindex` to replace `lat search --reindex`, with backend selection, a durable local preference, a `--remote` override, and progress driven by completed work. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Made queries use the backend recorded in the index, preventing credential changes from silently switching models. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Improved initialization onboarding and added a repository workflow for `lat check` in GitHub Actions. [#39](https://github.com/vercel-labs/lat.md/pull/39) [#48](https://github.com/vercel-labs/lat.md/pull/48)

### Bug fixes

Index rebuilds handle bad credentials, legacy caches, and worker failures more safely.

- Handled invalid credentials, rebuilt legacy caches lacking model metadata, reported worker crashes, and cleaned up failed index builds; backend preferences are saved only after successful builds. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Made prompt hooks read-only so retrieving context cannot trigger index rebuilds. [#75](https://github.com/vercel-labs/lat.md/pull/75)
- Replaced this repository’s linked agent instruction files with copies to prevent recursive instruction discovery. [#49](https://github.com/vercel-labs/lat.md/pull/49)

---

## 0.11.0

Agent setup expands to Codex and OpenCode, and C links can target fields and enum values. [Release #38](https://github.com/vercel-labs/lat.md/pull/38)

- Added Codex MCP setup, OpenCode plugin-registered tools, and Cursor stop hooks for end-of-task validation.
- Added C struct-field and enum-value links, including qualified targets and fields inside anonymous structs and unions.

---

## 0.10.4

Section output identifies the complete line range of referenced source definitions. [Release #37](https://github.com/vercel-labs/lat.md/pull/37)

- Added complete source-definition line ranges to `lat section` output, such as `file.ts:10-25`.

## 0.10.3

C source links recognize declarations inside additional language and preprocessor constructs. [Release #35](https://github.com/vercel-labs/lat.md/pull/35)

- Fixed C declaration lookup inside preprocessor conditionals and `extern "C"` blocks, including pointer typedefs and function declarations.

## 0.10.2

Source parsing uses memory more reliably and recognizes more C declarations. [Release #34](https://github.com/vercel-labs/lat.md/pull/34)

- Fixed a tree-sitter WASM memory leak and cached parsed source symbols to avoid reparsing unchanged files.
- Fixed missing C pointer-returning functions, function-like macros, and array variables.

## 0.10.1

Python source links correctly identify decorated declarations. [Release #33](https://github.com/vercel-labs/lat.md/pull/33)

- Fixed source-symbol lookup for decorated Python functions and classes.

## 0.10.0

Reference discovery becomes faster, and section output includes more useful source context. [Release #30](https://github.com/vercel-labs/lat.md/pull/30)

### Features and improvements

Readers can follow documentation-to-code relationships without opening every source file manually.

- Added source-file reference queries, code backlinks, and outgoing definition snippets in `lat section`; `lat refs` now includes Markdown and code by default.
- Added ripgrep-backed discovery with a TypeScript fallback, check timing, and installation suggestions when ripgrep is unavailable.
- Rendered Pi tool results and custom Lat messages as styled Markdown.

### Bug fixes

Reference paths and fallback selection now behave consistently.

- Made code-reference paths project-relative and fixed the ripgrep-disable override to activate only for its explicit enabled value.

---

## 0.9.0

Agent initialization installs reusable guidance for maintaining Lat documentation. [Release #25](https://github.com/vercel-labs/lat.md/pull/25)

- Added the `lat-md` authoring skill to initialization for supported agents and clarified the setup menu’s continuation action.

---

## 0.8.2

Initialization makes command invocation explicit and checks setup prerequisites more consistently. [Release #24](https://github.com/vercel-labs/lat.md/pull/24)

### Features and improvements

Users can choose how generated integrations invoke Lat.

- Added a global, local, or `npx` command-style choice and an upfront npm version check during initialization.

### Bug fixes

Setup respects existing configuration and tracked files.

- Used the shared credential resolver for setup key checks and stopped ignoring integration files already tracked by Git.

## 0.8.1

Interactive initialization no longer crashes when successive prompts share standard input. [Release #23](https://github.com/vercel-labs/lat.md/pull/23)

- Fixed initialization crashing when readline and selection menus share stdin.

## 0.8.0

Pi integration and interactive agent selection simplify onboarding. [Release #22](https://github.com/vercel-labs/lat.md/pull/22)

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

Section output includes descendants, and stop hooks block only when follow-up work is needed. [Release #21](https://github.com/vercel-labs/lat.md/pull/21)

- Included subsections in `lat section` output and limited stop-hook blocking to validation failures or out-of-sync documentation.

## 0.7.1

CLI output becomes easier to scan, and YAML frontmatter is parsed correctly. [Release #18](https://github.com/vercel-labs/lat.md/pull/18)

- Added Markdown headings, blockquotes, and navigation hints to command output, and fixed YAML frontmatter parsing.

## 0.7.0

Section retrieval, more source languages, and versioned initialization broaden Lat's agent workflow. [Release #17](https://github.com/vercel-labs/lat.md/pull/17)

### Features and improvements

New commands expose full context and validate the structure that makes it useful.

- Added `lat section` and its MCP tool, renamed `lat prompt` to `lat expand`, and added hook reference expansion and search navigation hints.
- Added Rust, Go, and C source links, including Rust implementation methods, Go methods, and declarations in `.c` and `.h` files.
- Added `lat check sections` to require concise leading paragraphs beneath headings.
- Added init versions, generated-file hashes, automatic refreshes, overwrite prompts for user edits, and hook synchronization; replaced the shell prompt hook with a native command.

### Bug fixes

Validation and setup report invalid inputs instead of hiding failures.

- Reported corrupt configuration, unreadable source files, and unsupported source extensions; flagged non-Markdown vault files under this release’s validation rules.
- Improved initialization input validation and existing-hook detection.

---

## 0.6.0

Wiki links can target source-code symbols as well as documentation sections. [Release #16](https://github.com/vercel-labs/lat.md/pull/16)

- Added project-root-relative source links for JavaScript, TypeScript, and Python declarations and supported class members, so vault documents can reference code elsewhere in the repository.

---

## 0.5.0

Initialization guidance and canonical section IDs make project setup and links more predictable. [Release #15](https://github.com/vercel-labs/lat.md/pull/15)

- Suggested `lat init` when no vault exists, and changed directory index entries to wiki links for graph navigation and validation.
- Fixed canonical section IDs to include the root H1 heading instead of dropping it from section paths.
