---
lat:
  require-code-mention: true
---

# Configuration

Tests verify durable user configuration and read-only storage diagnostics in isolated XDG directories.

## Repository preferences

Repository embedding choices coexist with manually configured hosted keys.

### Persists local preference

Writing and reading a local repository preference round-trips its absolute path without replacing the manual `llm_key` field.

## Storage information

The paths command describes effective paths for each CLI distribution and honors project discovery without initializing storage or exposing secrets.

### Project paths without side effects

Full and core paths report user/project locations as Markdown headings, list entries, and inline-code paths. Help exposes paths instead of info. Core omits full-package storage.

Temporary implementation paths are omitted. Neither invocation changes files or invokes credential helpers.

### Configuration outside a project

Paths works without a project. Its config filter and the hidden legacy alias return identical file locations and existence markers, even when the selected project directory does not exist.
