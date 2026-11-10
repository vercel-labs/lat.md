---
"lat.md": minor
"@lat.md/core": patch
---

Move agent validation from end-of-turn hooks to Git pre-commit checks of staged content. Ordinary manual commits skip validation. Re-run `lat init` to migrate existing integrations and install the Git hook; custom hooks and hook managers are preserved with integration instructions.

The hook supports partial commits, linked worktrees, and internal symlinks under aliased temporary directories. Configure `lat.git-pre-commit.exclude-projects` in the repository's root `lat.md/lat.md` frontmatter to exclude intentionally invalid fixture projects.
