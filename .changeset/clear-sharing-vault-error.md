---
'lat.md': patch
---

`lat ui` with a non-loopback `--host` now explains when no vault Markdown is shareable (for example, an untracked `lat.md/` in a Git project) and how to fix it, instead of crashing with a misleading "No readable Markdown files" stack trace.
