---
"lat.md": minor
"@lat.md/core": patch
---

Make Git commit checks the default workflow. `lat init` now asks, before agent selection, whether to install the agent-only Git pre-commit hook that runs `lat check` when a coding agent commits. Accepting it replaces end-of-turn validation: Claude/Codex Stop hooks and the Cursor stop hook are removed, the Pi/OpenCode completion callbacks are disabled, and generated instructions describe commit-time validation. If you decline the hook, or the project has no Git repository, init offers to keep enforcing `lat check` through coding agent hooks when an agent finishes a turn; declining that too leaves validation to you. Re-runs offer your earlier answers as defaults.

Rerun `lat init` after upgrading; `lat check` prints a reminder until you do. Existing end-of-turn hooks keep working in the meantime. `lat init --experimental` is still accepted but does nothing, and choices saved by the experiment are no longer read: projects that enabled it under 0.13.8 or earlier are not validated at commit time until `lat init` is rerun.
