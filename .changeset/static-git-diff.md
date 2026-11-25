---
'lat.md': minor
---

`lat ui`, `lat ui build static`, and `lat ui build server` accept `--git-diff <ref>` to show Git changes since the merge base of `<ref>` and `HEAD`, plus uncommitted edits, instead of uncommitted edits alone. The live UI follows the ref as it moves, and exported sites carry the same inline diffs, sidebar markers, and Git toggle as the local UI, making branch documentation previews possible, for example `lat ui build static --git-diff origin/main`. Builds without the flag still contain no Git state.

`lat ui run --no-git` now disables Git integration; previously the flag only took effect before `run`.
