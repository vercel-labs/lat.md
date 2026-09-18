# Package Distribution

Lat separates core validation and navigation from the full CLI. The same core checker also powers a portable GitHub Action artifact, built and released from this repository.

## Package Contract

`@lat.md/core` exposes `lat-core`. The full `lat.md` package depends on core and exposes `lat` with every existing command. Both executables can be installed together.

| Distribution | Executable | Command scope |
| --- | --- | --- |
| `@lat.md/core` | `lat-core` | `check`, `locate`, `section`, `refs`, `expand`, `external`, `info` |
| `lat.md` | `lat` | Core plus UI, search, reindexing, initialization, hooks, MCP, and template generation |

All check subcommands and the hidden `prompt` alias remain available in core. Shared implementations preserve validation semantics and explicit check-directory behavior from [[cli]]. Help and navigation hints identify the invoked executable and available commands; each executable reports its own package version. Initialization and generated agent integrations remain in the full package because they use search and the `lat` executable.

## Dependency Boundary

[[packages/core]] owns graph analysis, validation, parsing, reference resolution, project discovery, external-source resolution, and shared commands. The full package consumes explicit core exports; core does not import full-package modules.

Core excludes database and writer-lock bindings, stemmers, embedding engines and weights, HTTP/MCP servers, browser assets, and deployment tooling. [[packages/core/package.json]] declares its independent build, public module exports, executable, and runtime dependencies. Shared document-tree and search metadata types live in core without search execution code.

Validation retains every supported source language and external document format. [[packages/core/src/source-parser.ts]] loads Tree-sitter and language grammars; [[packages/core/src/external-documents.ts]] uses AsciiDoc and reStructuredText parsers for external headings. Parser workers and dynamically loaded modules ship with core. Lazy loading reduces startup work but does not reduce the installed dependency tree.

`pnpm build:core` compiles core without UI builds, Rust, or model downloads. The full build first builds core and clears obsolete root output so moved modules do not remain in the published full package. [[scripts/vendor-site-packages.mjs]] includes core when constructing a portable site distribution from unpublished workspace packages.

## CLI Composition

[[packages/core/src/cli/core.ts#createCli]] accepts a command name, version, and arguments, returning a Commander program and normalized arguments. Entry points register commands before parsing, so help reflects each distribution's capabilities.

[[packages/core/src/cli/index.ts]] runs only the core command tree. [[src/cli/index.ts]] adds the full commands to that same tree. Shared actions load command implementations on demand. No plugin discovery or global-package resolution is involved.

## GitHub Action

[[action.yml]] declares a Node 24 JavaScript action. [[scripts/build-check-action.mjs]] creates its portable distribution with compiled core and the exact production dependency versions from the workspace lockfile.

The builder installs into an isolated temporary directory using a hoisted dependency layout and no lifecycle scripts. It includes workers, dynamic modules, parser data, and WASM assets. The default output is `.lat-build/check-action`, outside source control. Consumers run the prebuilt release artifact without package installation, project builds, setup-node, or embedding credentials.

[[action/index.js]] runs the full core check in `working-directory`, relative to the checked-out workspace by default. The `profile` input enables timing output. Paths are passed without shell interpolation; diagnostics and failure status are preserved, and the bundled core version is logged. External references retain normal fetch/cache behavior, so uncached external content can still require network access.

[[.github/workflows/publish-action.yml]] publishes a minimal repository snapshot through manually dispatched `action-vX.Y.Z` tags and a maintained `action-vX` tag. It tests the exact generated artifact on Linux, Windows, and macOS before atomically pushing the immutable and major tags. The source commit is recorded in the distribution commit. Action tags are independent of npm versions; each artifact fixes its included core version.

The consumer form is `uses: vercel-labs/lat.md@action-v1` after the first action release. Source branches do not contain the generated runtime and are not directly runnable action releases. The repository remains the single home for source, tests, npm packages, and action release automation.

## Publishing and Validation

Core is published before the full package, and pnpm rewrites workspace dependencies to exact versions. A single PR can change and bump both packages; unchanged published versions are skipped by the existing release workflow.

[[.github/workflows/publish.yml]] includes core in dependency order. The new npm package requires its trusted-publishing configuration before its first release, just like the other workspace packages. Publishing the dependency first prevents the full package from referencing an unpublished core version; the separate npm publications are not atomic.

[[.github/workflows/lat-check.yaml]] uses [[scripts/prepare-core-install.mjs]] to derive a standalone lockfile and installs only core's dependency closure, validates current source, and exercises packed core and relocated action artifacts on three platforms. The full CI also tests full-only and combined packed installations using local workspace tarballs, including unpublished changes.

[[scripts/test-core-distribution.js]] covers package isolation, help, exit codes, source grammars, external parsers, worker assets, and full/core parity. [[scripts/test-check-action.js]] covers relocation, paths containing spaces, profiling, missing directories, and validation failures without project dependencies. Their contracts are recorded in [[tests/distribution-tests]].
