# Changesets

Every PR adds a new Markdown file here. Run `pnpm changeset` and select every
published package affected by the change. Write the summary for users, including
the practical effect of the change. Include `lat.md` for changes visible through
the full CLI, even when their implementation is in a supporting package, so its
public changelog includes the explanation. Use patch for fixes and minor for features
or breaking changes while packages are pre-1.0.

For docs, tests, or tooling changes that need no package release, run
`pnpm changeset --empty` and add a sentence explaining why no release is needed.
An existing pending changeset does not satisfy the check for a new PR.

Run `pnpm changeset:check main` to check the branch locally. CI runs the
same check against the PR base. Reviewers verify package selection, bump types,
and whether an empty changeset is appropriate.

Maintainers run `pnpm release:version` on a release branch. This consumes pending
files, updates versions and package changelogs, refreshes the lockfile, and syncs
the root package's release notes into `lat.md/changelog.md`. Review and commit
the result, then open a release PR. Release-only changes may consume files
without adding another changeset. Publishing happens after merging through the
existing workflow; versioning does not publish anything.

Make the `Changesets` status check required for `main` in GitHub's branch rules
after the workflow has been introduced. A failing workflow alone does not block
merging unless the repository requires its check.
