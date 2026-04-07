# Release Policy

This document describes how lodestar packages are versioned, released, and published.

## Versioning Strategy

lodestar uses **independent versioning** — each package in the monorepo has its own version number and follows [Semantic Versioning (SemVer)](https://semver.org/).

Independent versioning is chosen because packages like `@retemper/plugin-structure`, `@retemper/plugin-boundary`, and `@retemper/plugin-deps` have minimal internal dependencies and evolve at different rates from `@retemper/core` or `@retemper/cli`.

### Pre-1.0 Contract

While a package is below `1.0.0`:

- **Patch** (`0.0.x`): Bug fixes, documentation, internal refactors.
- **Minor** (`0.x.0`): New features **and** breaking changes.

This follows [standard SemVer 0.x semantics](https://semver.org/#spec-item-4). After a package reaches `1.0.0`, breaking changes require a major version bump.

## Tooling

We use [changesets](https://github.com/changesets/changesets) for version management — the same tool used by [Vite](https://github.com/vitejs/vite), [Turborepo](https://github.com/vercel/turborepo), [Radix UI](https://github.com/radix-ui/primitives), and many other popular open-source projects.

## Changeset Workflow

### For contributors

Every PR that changes the behavior of a published package must include a changeset:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select the affected package(s).
2. Choose the bump type (`patch`, `minor`, or `major`).
3. Write a concise summary (this becomes the CHANGELOG entry).
4. Commit the generated `.changeset/*.md` file with your PR.

### What requires a changeset

| Change type                       | Changeset needed?                    |
| --------------------------------- | ------------------------------------ |
| Bug fix in `packages/*`           | Yes (`patch`)                        |
| New feature in `packages/*`       | Yes (`minor`)                        |
| Breaking change in `packages/*`   | Yes (`major`, or `minor` if pre-1.0) |
| Performance improvement           | Yes (`patch`)                        |
| Internal refactor (no API change) | Optional                             |
| Documentation only                | No                                   |
| Test only                         | No                                   |
| CI/build config                   | No                                   |
| Changes to `examples/*`           | No                                   |

### What happens after merge

When a PR with changesets is merged to `main`:

1. The [Release workflow](./.github/workflows/release.yml) detects pending changesets.
2. It creates (or updates) a **"chore: version packages"** PR that:
   - Bumps package versions based on accumulated changesets.
   - Updates `CHANGELOG.md` in each affected package.
   - Removes consumed `.changeset/*.md` files.
3. When a maintainer merges the version PR:
   - Packages are published to npm.
   - Git tags are created for each published package.
   - GitHub Releases are created with auto-generated notes.

## Snapshot Releases

For testing unreleased changes before merging, maintainers can publish snapshot versions:

1. Comment `/snapshot` on an open PR.
2. The [Snapshot workflow](./.github/workflows/snapshot.yml) publishes packages under a PR-specific dist-tag.
3. A comment is posted with install instructions.

Snapshot versions use the format `0.0.1-pr42.0` and are published under the `pr42` dist-tag, so they never affect the `latest` tag.

## Release Cadence

There is no fixed release schedule. Releases happen when a maintainer merges the version PR. The version PR accumulates changesets over time, giving maintainers control over release timing.

## npm Provenance

All releases include [npm provenance](https://docs.npmjs.com/generating-provenance-statements) attestation, providing a verifiable link between the published package and its source code in this repository. This enhances supply chain security by allowing consumers to verify that packages were built from the expected source.

## Who Can Release

- **Contributors**: Add changesets to their PRs.
- **Maintainers**: Merge the version PR to trigger a release, or comment `/snapshot` for pre-release testing.

## Breaking Changes

Breaking changes require explicit documentation:

1. Include `major` bump type in the changeset (or `minor` for pre-1.0 packages).
2. Describe **what changed** and **how to migrate** in the changeset summary.
3. The CHANGELOG entry will be generated from this summary.

## Internal Dependencies

When a dependency package (e.g., `@retemper/types`) is bumped, all packages that depend on it automatically get their dependency range updated via `updateInternalDependencies: "patch"` in the changesets config. This ensures consistent dependency versions across the monorepo.
