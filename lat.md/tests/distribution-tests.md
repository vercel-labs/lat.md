---
lat:
  require-code-mention: true
---
# Package Distribution

Distribution tests exercise packed installations and the relocated check action outside the development workspace, ensuring dependencies and assets are sufficient without workspace fallbacks.

## Core installs independently

A packed core install exposes `lat-core` with validation and navigation commands, excludes UI/search dependencies, and reports valid and invalid documentation correctly, including explicit check directories.

## Core ships parser and worker assets

The packed core executes Markdown worker analysis, loads every supported source grammar, and parses external AsciiDoc and reStructuredText documents from an isolated consumer installation.

## Full and core installations agree

Full-only and combined packed installs retain the full command surface, expose distinct executables, and produce the same validation result as core. Local package overrides exercise unpublished workspace changes.

## Action runs without installation

The generated action works after relocation, checks a workspace subdirectory containing spaces, reports its core version, and runs without installing project dependencies or embedding assets.

## Action preserves validation failures

Broken references fail the action with their original diagnostics. Invalid profiling inputs and nonexistent working directories also fail rather than silently succeeding.
