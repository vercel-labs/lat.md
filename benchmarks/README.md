# Search access benchmark

Comparison of the copy-per-session implementation at `0c8a49f` against scoped
access locks on Turso 0.7.2. The baseline is reconstructed from Git, without
changing the checkout or dependencies. After splitting the PR, `bc32a58` retains
the identical copy-based search implementation and is the reproduction baseline;
the recorded results retain the original commit reference.

Run after building the workspace:

```sh
node scripts/benchmark-search-access.mjs bc32a58 1000,10000,50000
```

The harness builds actual indexed documents with unique passage inputs and 384D
vectors. It runs real FTS and exact cosine retrieval, verifies identical results,
and alternates old/new order for 15 measured iterations after two warmups. A
fixed embedding backend removes embedding-model and network variance. Filesystem
caches are warm; these are in-process search measurements, excluding CLI startup,
Markdown project analysis, and real embedding generation. Concurrent throughput
is not measured: 0.7.2 searches now serialize database access.

`session` includes opening a session, reading metadata, querying, and closing it.
`persistent` measures queries through an already-open session: the old version
keeps its private database open, whereas the new version reopens the published
database for each query. Initial session setup is excluded from that measurement.
Database sizes use decimal MB.

Recorded on macOS arm64, Node 24.19.0:

| Passages | Database MB | One-shot copy / lock, median ms | Reused session copy / lock, median ms |
| ---: | ---: | ---: | ---: |
| 1,001 | 7.79 | 8.90 / 4.82 | 2.74 / 4.29 |
| 10,001 | 77.37 | 71.31 / 36.67 | 34.11 / 36.15 |
| 50,001 | 387.39 | 313.85 / 201.91 | 193.14 / 200.31 |

The lock removes the full-file copy on one-shot searches, reducing their median
latency by 36–49% in this run. Reopening the database costs persistent sessions
about 1.6–7.2 ms per query. Results are hardware/cache dependent; they do not
predict cold-disk or concurrent-process performance.

Raw median and p95 results: [search-access-macos.json](search-access-macos.json).
