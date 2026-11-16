# @lat.md/core

## 0.1.5

### Patch Changes

- Handle projects without Git in the experimental commit checks. When the commit-hooks experiment is enabled outside a Git repository, `lat init` now warns that Lat works best with Git and suggests running `git init` first. You can continue without Git and choose whether `lat check` is enforced through coding agent hooks when an agent finishes a turn; previously such projects silently lost all validation. If the project later gains a Git repository, `lat check` reminds you to rerun `lat init` and switch to the pre-commit hook. Setups without the experiment are unchanged.

## 0.1.4

### Patch Changes

- 2ac1aea: Check only the source being read when verifying external-source configuration around each file read. Commands no longer re-run Git identity checks on every other local checkout for each external file, which made `lat check` several times slower with multiple local overrides, especially on network file systems.
