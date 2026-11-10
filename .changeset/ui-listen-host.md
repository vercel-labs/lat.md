---
"lat.md": minor
---

Add `--host <address>` to `lat ui` and `lat ui run`. Use `--host 0.0.0.0` to
listen on all IPv4 interfaces; the default remains `127.0.0.1`.

Network listeners use read-only sharing restricted to public vault Markdown and
explicitly linked public files. Hidden, ignored, untracked, and unlinked project
files remain private. Git diffs and change indicators remain available for shared
Markdown. Editing, search, and section-command output are available only in the
private loopback UI.
