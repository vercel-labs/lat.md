---
lat:
  require-code-mention: true
---

# Search

Tests in `tests/search.test.ts`.

## Provider Detection

Unit tests (always run). Verify `detectProvider` (now exported from
[[packages/embed/src/remote.ts#detectProvider]] in `@lat.md/embed`) correctly identifies OpenAI
(`sk-`), Vercel (`vck_`), rejects Anthropic (`sk-ant-`) with a helpful message, and rejects unknown
prefixes.

## RAG Tests

Functional tests that exercise the full RAG pipeline using the **local MiniLM engine**, which
produces deterministic vectors — so they run the real WASM embedder directly, with no API key, no
network, and no replay recording.

The test covers indexing, hashing, vector insert, and KNN search. Fixture lives in
`tests/cases/rag/lat.md/` (9 sections across 2 files). A supplementary `search (rag, hosted replay)`
group exercises the hosted `fetch` backend against a local OpenAI-compatible replay server
(`tests/rag-replay-server.ts`); it runs only when `tests/cases/rag/replay-data/owned-blocks-v1/` is present and is
re-cooked with `pnpm cook-test-rag` if hosted chunking changes.

### Indexes all sections

Index the RAG fixture (9 sections across 2 files), verify counts.

### Finds auth section for login query

Search for "how do we handle user login and security?" and verify the Authentication section ranks
first.

### Filters results below the similarity threshold

Semantic candidates must meet the requested cosine minimum. Independent lexical matches remain eligible below this threshold.

### Applies the shared default similarity threshold

Every semantic-search path applies [[src/search/search.ts#DEFAULT_MIN_SIMILARITY]] unless its public interface supplies an
explicit override, keeping CLI, MCP, hooks, and UI ranking policy aligned.

### Applies the shared default result limit

CLI, MCP, and prompt-hook semantic search use [[src/search/search.ts#DEFAULT_SEARCH_LIMIT]] unless a caller explicitly overrides it; the UI retains its named presentation-specific limit.

### Finds performance section for latency query

Search for "what tools do we use to measure response times?" and verify the Performance Tests
section ranks first.

### Debug output includes similarity scores

Search debug output exposes the fused rank score and individual retrieval contributions while normal output shows source evidence.

### Deterministic embeddings

Embedding the same text twice yields byte-identical vectors — the property that lets the local RAG
tests run the real engine without recording fixtures.

### Incremental index skips unchanged sections

Re-index unchanged content, verify all sections reported as unchanged with zero re-embedding.

### Detects deleted sections when file is removed

Remove `testing.md`, re-index, verify 4 sections removed and 5 architecture sections remain.

### Reads each file once when indexing

A passthrough `readFile` spy verifies indexing reads each `lat.md` file a bounded number of times
however many sections it holds: the parser reads it once and section slicing reuses that read.

Before this was pinned, a 3.5 MB file holding 12k sections was re-read once per section — 12k
times on every search.

### Builds a fresh index beside a legacy cache

Search ignores legacy database bytes and builds a fresh index using the currently selected embedding backend. An invalid legacy file must not prevent a successful local search.

### Reuses an indexed search session

An indexed search session reuses an embedder, closes database access between queries, applies each query's limit and threshold, and returns storage rows without project metadata. A shared resolver hydrates known section ids for every caller.

### Rejects changed session metadata

A session rejects changed index metadata before retrieval, releases database access on that error, and rejects queries after closing.

### Skips an unbuilt search index

Opening a query-only session before an index exists returns no matches without loading an embedder, while still closing the database cleanly.

### Patches generated WASM loading explicitly

The package build replaces wasm-bindgen's opaque filesystem loader with an explicit byte initializer that is idempotent and discoverable by deployment tracers.

### Rejects unknown generated WASM glue

The package build fails clearly when generated wasm-bindgen output no longer contains the loader shape Lat knows how to replace.

## Hybrid Retrieval

Tests in [[tests/hybrid-search.test.ts]] verify passage ownership, token safety, hybrid evidence, and transactional cache publication.

### Skips document preambles

Indexing skips logos and prose before the first heading without failing. Heading-owned passages retain their section IDs and remain searchable.

### Keeps duplicate and formatted headings distinct

Indexing preserves separate passages and search results for repeated or formatted headings. Incremental edits keep sibling content intact, and unchanged indexes refresh obsolete parser freshness metadata without re-embedding.

Passing each search result ID or its short form to the section command core returns only the matching section body, excluding its siblings.

### Preserves complete passage coverage

Oversized prose, nested lists, code lines, table cells, and Unicode retain source coverage and fit the embedding model input budget without duplicating descendant content.

### Rejects local embedding truncation

The real local tokenizer counts the full input and the WASM embedder rejects text beyond its limit, including tokenizer configurations containing an embedded truncation setting.

### Retrieves lexical evidence independently

Exact identifiers remain discoverable below the semantic minimum, with evidence linked to source spans in the owning section.

### Collapses before rank fusion

Repeated passage owners collapse before ranks are assigned, and equal channel scores share a section rank.

### Reuses vectors after source movement

Adding blank lines changes source locations without re-embedding unchanged contextual inputs.

### Keeps incremental FTS scores equal to fresh indexes

Section replacements, deletions, and deleting all sections produce the same lexical scores and hybrid ranks as fresh indexing, while line-only edits reuse every embedding.

### Repairs historical FTS statistics once without embedding

An unchanged project repairs old lexical statistics without embedding calls. Failed maintenance rolls back scores and version metadata; subsequent no-op indexing does not rebuild FTS.

### Rolls back failed FTS rebuilds

A failed FTS rebuild restores the prior sections and searchable scores, and a subsequent successful indexing attempt applies the edit.

### Publishes only successful indexes

A failed build preserves the exact bytes and searchable content of search.db, removes staging files, and releases the writer lock.

### Reuses a single database filename

Repeated reindexing leaves search.db and persistent writer/access lock files, without manifests or staging files. A writer discards abandoned staging files and sidecars. Unchanged incremental work preserves the published file.

### Preserves the database when replacement fails

A failed rename leaves search.db byte-for-byte intact, removes staging files, and releases the writer lock so a subsequent indexing attempt can succeed.

### Preserves FTS rollback and portable copies

Rolled-back writes do not leak into FTS; a checkpointed database retains scored search when copied and reopened.

### Switches preview without changing relevance

Passage, introduction, and combined previews use the same ranked match while changing only its presentation.

### Ignores legacy caches

Index publication ignores old databases, sidecars, and migration metadata. It starts without an inherited model and leaves legacy files untouched, even when they contain invalid data.

### Serializes concurrent index writers

Concurrent writers cannot interleave staging or replacement, and readers reopen the published database after replacement.

### Rejects invalid vectors before changing the index

Missing or malformed embedding output fails before indexed data is modified, preserving previous retrieval evidence.

### Validates hosted input and response ordering

The hosted tokenizer rejects oversized input before network access, and response vectors are reordered to match input indices.

### Overfetches toward unique sections

Repeated passages from one owner trigger deeper candidate retrieval, while the hard passage budget reports exhaustion instead of pretending section recall is complete.

### Keeps readers alive across process boundaries

A child process holds database access while a parent builds a replacement. Publication waits for the child to finish reading and close; new readers then see the replacement.

### Stems English lexical fields and queries

English inflections match across indexed fields and queries while original evidence, Unicode tokens, and exact identifier lookup remain intact. Updating a passage removes its old lexical terms.

### Upgrades lexical indexes without embedding again

An index with unstemmed FTS migrates to normalized lexical fields without regenerating vectors or changing source passages.

### Packages stemmer runtime assets

Server dependency tracing includes both the stemmer JavaScript glue and WASM binary so deployed search can initialize outside the workspace.

### Ignores lock file contents

Empty, malformed, or obsolete PID data does not block acquisition. Independent descriptors still exclude each other, and releasing a lock leaves its persistent file in place.

### Never steals a live writer lock

A contender times out while another process holds the lock, and a subsequent writer acquires it after normal release. Timeouts do not evict the owner.

### Recovers from a killed writer

Killing a writer before publication preserves search.db. Waiting processes acquire the kernel lock one at a time, discard abandoned staging data, and successfully publish a replacement.

### Coordinates shared and exclusive access

Shared lock holders coexist across processes, exclusive access waits for every holder, process death releases ownership, and callback failures do not leak locks.

### Releases database access after failed queries

A failed database query closes and releases exclusive access so subsequent processes and database connections can proceed.

### Embeds outside database access

A blocked embedding operation leaves database access available to publication. Session closure waits for that query to finish and rejects new queries.

### Recovers from a killed reader

A reader killed with an open database connection releases access. Incremental indexing recovers the published database and subsequent processes can query it.

### Rebuilds an unreadable published database

A fresh rebuild can replace invalid cached database bytes when no pending WAL requires recovery, without opening the invalid database first.
