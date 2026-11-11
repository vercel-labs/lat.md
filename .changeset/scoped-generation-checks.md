---
"lat.md": patch
"@lat.md/core": patch
---

Check only the source being read when verifying external-source configuration around each file read. Commands no longer re-run Git identity checks on every other local checkout for each external file, which made `lat check` several times slower with multiple local overrides, especially on network file systems.
