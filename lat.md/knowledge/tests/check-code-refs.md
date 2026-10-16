---
lat:
  require-code-mention: true
---

# Check Code Refs

Tests for validating `@lat:` code references and required code mention coverage.

## Detects dangling code ref

Given a source file with `@lat: [[Nonexistent]]`, [[cli#check#code-refs]] should report it as pointing to a nonexistent section.

## Detects missing code mention for required file

Given a `lat.md` file with [[markdown#Frontmatter#require-code-mention]] and a leaf section not referenced by any `@lat:` comment in the codebase, [[cli#check#code-refs]] should report the uncovered section.

## Scans only supported source files

`scanCodeRefs` and the separate `discoverSourceFiles` API share the central source-extension registry across ripgrep and TypeScript fallbacks. Unsupported files are neither searched nor included in the UI's source watch scope.

Git projects inspect tracked regular files; non-Git projects walk visible, non-ignored files.

## Scans Dart references around annotations

Dart `// @lat:` references retain their authored line numbers before ordinary declarations and between metadata annotations and declarations, and dangling targets remain normal code-reference errors.

## Unambiguous reference filenames

Ripgrep and the fallback preserve colon and newline filenames exactly, preventing a filename from redirecting backlink snippets to another file.

## Parses balanced targets without a nesting limit

Code-reference extraction agrees with wiki-link boundaries for route names, deeply nested brackets, and aliases, preserving multiple marked references on one line and both supported comment prefixes.

## Rejects incomplete code-reference targets

Zero-length targets, stray closing brackets, and multiline targets are ignored without swallowing a subsequent marked reference. A missing closing marker cannot be supplied by a later reference.

## Preserves legacy code-reference targets

When balanced parsing fails, unmatched opening brackets, empty aliases, and whitespace-only targets retain their old literal extraction. Recovery cannot consume the next marked reference, even when later brackets could balance the first target.

## Scans bracketed required-section targets

Ripgrep and the fallback resolve balanced and legacy unmatched-bracket required sections, report a missing mention when a reference is removed, and diagnose a complete bracketed target when its section does not exist.
