# Continuous integration

Run Lat in CI to catch broken documentation links, source references, and structure before changes merge. Validation errors fail the check and appear in the job log.

## GitHub Actions

Add a workflow to your repository to check documentation on pushes and pull requests.

Save this as `.github/workflows/lat-check.yml` once the `action-v1` release tag is available:

```yaml
name: Lat check
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: vercel-labs/lat.md@action-v1
```

The action installs `@lat.md/core` from npm and runs `lat-core check` at the repository root. It does not require your project's dependencies or an API key. Installation requires access to the npm registry; configured external sources may also require network access.

Node setup ensures npm is available on the runner. The action supports Linux, Windows, and macOS. See [[concepts#What Lat checks]] for validation coverage.

## Choose a version

The action uses npm's `latest` version of core by default, so new core releases reach your workflow without updating the action.

A newer checker may report errors in a repository that previously passed. Pin core when you want to control checker upgrades:

```yaml
- uses: vercel-labs/lat.md@action-v1
  with:
    version: '0.1.0'
```

Use an exact published core version or a distribution tag such as `latest`. The action logs the installed version on every run. Core has its own version numbers, separate from the full `lat.md` package.

The action version controls the installer and launcher. Pinning the action to a commit does not pin core when `version` is `latest`. An exact core version selects that release, but its dependency ranges still resolve during installation.

## Check a subdirectory

Use `working-directory` when your Lat project lives below the repository root, and enable `profile` to investigate slow checks.

```yaml
- uses: vercel-labs/lat.md@action-v1
  with:
    working-directory: docs/project
    profile: 'true'
```

The directory is relative to the checked-out workspace. The action installs core in a separate temporary directory and removes that installation after checking.

## Other CI providers

Install the core package in a Node.js environment and invoke its checker from your project root.

With Node.js 24 and pnpm available:

```bash
pnpm dlx @lat.md/core@latest check
```

Replace `latest` with an exact core version to control upgrades. The core package supplies validation without the full CLI's search and browser dependencies.
