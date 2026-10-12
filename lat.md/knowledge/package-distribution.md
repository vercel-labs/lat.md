# Package Distribution

Lat separates core validation and navigation from the full CLI. The same core checker also powers a GitHub Action that installs the published core package.

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

Validation retains every supported source language and external document format. [[packages/core/src/source-parser.ts]] loads Tree-sitter and language grammars; [[packages/core/src/external-documents.ts]] uses AsciiDoc and reStructuredText parsers for external headings. Parser workers and dynamically loaded modules ship with core. Mermaid validation ships as a generated bundle rather than adding its upstream dependency tree to production installs.

`pnpm build:core` compiles core without UI builds, Rust, or model downloads. The full build first builds core and clears obsolete root output so moved modules do not remain in the published full package. [[scripts/vendor-site-packages.mjs]] includes core when constructing a portable site distribution from unpublished workspace packages.

### Mermaid validation bundle

[[packages/core/scripts/build-mermaid.mjs]] bundles the lazy validation worker with esbuild. Mermaid, Dagre, JSDOM, and esbuild are pinned build dependencies; consumers need no extra installation or browser download.

The build tree-shakes, minifies, and splits upstream modules into core's generated `dist/mermaid-runtime` directory. It preserves upstream parsing and layout implementations without checked-in vendored source. Asset adapters inline JSDOM's stylesheet and expose CSS-tree's JSON loads to esbuild; JSDOM's synchronous XHR helper is emitted beside its chunks. Optional Canvas remains unused by text analysis.

The build rejects unexpected external package imports, includes third-party licenses, and fails above a 3 MiB gzip budget. The generated size manifest records the sum of individually gzipped bundle files; this is a build guard, not a measurement of the complete npm install. [[scripts/test-core-distribution.js]] exercises the worker from a packed production install without upstream development packages.

### Hosted tokenizer bundle

[[packages/embed/scripts/build-remote.mjs]] bundles the hosted embedding backend with only the upstream encoding used by Lat. `js-tiktoken` and esbuild are build dependencies; production installs omit the full encoding collection.

[[packages/embed/src/remote.ts#createRemoteEmbedder]] retains its token counting, input limits, and tokenizer fingerprint. The generated module is self-contained, includes license notices, and has a 600 KiB gzip build budget. No tokenizer implementation or rank data is maintained in the repository. [[tests/search#Hybrid Retrieval#Bundles only the hosted encoding]] checks equivalence to the complete upstream package outside workspace module resolution.

## CLI Composition

[[packages/core/src/cli/core.ts#createCli]] accepts a command name, version, and arguments, returning a Commander program and normalized arguments. Entry points register commands before parsing, so help reflects each distribution's capabilities.

[[packages/core/src/cli/index.ts]] runs only the core command tree. [[src/cli/index.ts]] adds the full commands to that same tree. Shared actions load command implementations on demand. No plugin discovery or global-package resolution is involved.

## GitHub Action

[[action.yml]] declares a composite action that sets up the required Node.js version and installs the published core package before checking the consumer's checkout. [[lat.md/docs/ci]] documents consumer setup and version selection.

[[action/index.js]] installs `@lat.md/core` from the public npm registry in a fresh runner temporary directory, with lifecycle scripts disabled. The `version` input defaults to `latest` and accepts exact versions or distribution tags. Each invocation resolves the requested version anew; no installed runtime is cached across runs. Invalid inputs fail before installation, and installation failures prevent validation.

The launcher finds npm on PATH and invokes its JavaScript entry point without a shell, including on Windows. It logs the installed core version and runs its full check in `working-directory`, relative to the checked-out workspace. The `profile` input enables timing output. Diagnostics and failure status are preserved, and the temporary installation is removed afterward. The composite action supplies Node and npm and maps its inputs explicitly into the launcher environment. Consumers only need to check out their project; they do not install project dependencies or provide embedding credentials.

[[.github/workflows/publish-action.yml]] tests on Linux, Windows, and macOS, including a live install through the local action. It publishes only the launcher and metadata through manually dispatched `check-vX.Y.Z` tags and a maintained `check-vX` tag. Core releases need no action release; action versions govern installation and execution logic. Floating core versions can change validation results for unchanged consumer commits, even when the action is pinned.

The consumer form is `uses: vercel-labs/lat.md@check-v1` after the first action release. Source branches also contain the runnable launcher. [[scripts/build-action-test.mjs]] builds an isolated core runtime only for tests; it is never included in action releases.

## Publishing and Validation

Core is published before the full package, and pnpm rewrites workspace dependencies to exact versions. A single PR can change and bump both packages; unchanged published versions are skipped by the existing release workflow.

[[.github/workflows/publish.yml]] includes core in dependency order. The new npm package requires its trusted-publishing configuration before its first release, just like the other workspace packages. Publishing the dependency first prevents the full package from referencing an unpublished core version; the separate npm publications are not atomic.

[[.github/workflows/lat-check.yaml]] uses [[scripts/prepare-core-install.mjs]] to derive a standalone lockfile and installs only core's dependency closure, validates current source, and exercises packed core and action installation and execution on three platforms. The full CI also tests full-only and combined packed installations using local workspace tarballs, including unpublished changes.

[[scripts/test-core-distribution.js]] covers package isolation, help, exit codes, source grammars, external parsers, worker assets, and full/core parity. [[scripts/test-check-action.js]] covers selected package versions, installation failure, invalid inputs, paths containing spaces, profiling, validation failures, and cache safety using a simulated npm installer and a real isolated core runtime. Their contracts are recorded in [[tests/distribution-tests]].
