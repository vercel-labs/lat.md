---
"lat.md": patch
---

Add `lat init --experimental` to choose experimental features per project. Setup explains each feature and saves choices in `lat.md/.cache/experiments.json`; ordinary init preserves them, and rerunning the experiment checklist lets you disable them.

The opt-in commit-hooks experiment moves agent validation from end-of-turn callbacks to Git pre-commit checks of staged content. Completion-hook behavior remains the default. Custom hooks and hook managers are preserved with integration instructions.

The hook supports partial commits, linked worktrees, and internal symlinks under aliased temporary directories. Configure `lat.git-pre-commit.exclude-projects` in the repository's root `lat.md/lat.md` frontmatter to exclude intentionally invalid fixture projects.

Agent commits with substantial staged code churn stop for a review of Lat coverage. After reviewing, agents can retry with `LAT_BYPASS_COMMIT_HOOK=1` when no update is needed or the changes are already covered, including by newly staged documentation. The flag skips only the review reminder; staged validation and other Git hooks still run.
