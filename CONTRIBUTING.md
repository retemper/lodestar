# Contributing to lodestar

Thank you for your interest in contributing to lodestar! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Adding a Changeset](#adding-a-changeset)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22 (see `.nvmrc`)
- [pnpm](https://pnpm.io/) >= 10

### Setup

```bash
git clone https://github.com/retemper/lodestar.git
cd lodestar
pnpm install
pnpm turbo build
```

### Verify everything works

```bash
pnpm test        # Run all unit tests
pnpm type-check  # TypeScript validation
pnpm lint        # Lint all packages
```

## Project Structure

lodestar is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/).

```
lodestar/
├── packages/
│   ├── types/              # @lodestar/types — Shared types and interfaces
│   ├── config/             # @lodestar/config — Configuration loading and normalization
│   ├── core/               # @lodestar/core — Core rule execution engine
│   ├── cli/                # @lodestar/cli — CLI interface
│   ├── accel/              # @lodestar/accel — Native acceleration facade
│   ├── accel-typescript/   # @lodestar/accel-typescript — Acceleration shared types
│   ├── accel-rust/         # @lodestar/accel-rust — Rust backend (napi-rs)
│   ├── accel-go/           # @lodestar/accel-go — Go backend (WASM)
│   └── lodestar/           # lodestar — Unified facade package
├── plugins/
│   ├── structure/          # @lodestar/plugin-structure — Directory structure validation
│   ├── boundary/           # @lodestar/plugin-boundary — Module boundary enforcement
│   ├── deps/               # @lodestar/plugin-deps — Dependency graph rules
│   └── content/            # @lodestar/plugin-content — Source content conventions
├── examples/
├── turbo.json              # Turborepo task pipeline
├── eslint.config.js        # ESLint flat config
└── vitest.workspace.ts     # Vitest workspace config
```

**Dependency direction:** `lodestar` → `core` → `config` → `types`. Plugins depend on `types` only. Accel packages are optional native backends.

## Development Workflow

### Working on a single package

```bash
# Build only the package you're working on (and its dependencies)
pnpm turbo build --filter=@lodestar/core

# Run tests for a single package
pnpm turbo test --filter=@lodestar/core

# Watch mode for tests
cd packages/core
pnpm test:watch
```

### Think before adding a dependency

lodestar aims to keep packages minimal. Before adding a new dependency:

- Could the functionality be implemented in a few lines of code?
- Does the dependency have its own large dependency tree?
- Is it tree-shakeable?

If the answer to the first question is yes, prefer implementing it yourself.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). See [`.github/commit-convention.md`](./.github/commit-convention.md) for the full specification.

Each commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scope** is the package name without the `@lodestar/` prefix (e.g., `core`, `cli`, `plugin-structure`).

**Examples:**

```
feat(core): add parallel rule execution strategy
fix(plugin-boundary): handle circular dependency detection
docs: update quick start guide
test(cli): add config resolution edge cases
chore: update TypeScript to 5.7
```

## Pull Request Guidelines

### Before submitting

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make sure all checks pass:**

   ```bash
   pnpm type-check
   pnpm test
   pnpm lint
   pnpm format:check
   ```

3. **Keep PRs focused.** One logical change per PR. If you find unrelated issues, open a separate PR.

### PR requirements

- Follow the [PR template](./.github/pull_request_template.md).
- PR title must follow [Conventional Commits](#commit-convention) format (we squash-merge).
- Add or update tests for any code changes.
- Ensure no type errors, lint errors, or test failures.
- For new features, update relevant documentation or examples.

### Review process

1. A maintainer will review your PR.
2. Address feedback by pushing new commits (do not force-push during review).
3. Once approved, a maintainer will squash-merge your PR.

## Adding a Changeset

If your PR changes the behavior of any published package (`packages/*`), you need to include a changeset:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select the affected package(s).
2. Choose the semver bump type (`patch`, `minor`, `major`).
3. Write a concise description of the change (this appears in the CHANGELOG).
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

See [RELEASE.md](./RELEASE.md) for the full release policy.

## Testing

We use [Vitest](https://vitest.dev/) for all unit testing.

### Running tests

```bash
# All tests
pnpm test

# Single package
pnpm turbo test --filter=@lodestar/plugin-structure

# Watch mode (from package directory)
cd plugins/structure
pnpm test:watch

# With coverage
pnpm turbo test --filter=@lodestar/plugin-structure -- --coverage
```

### Writing tests

- Every new feature or bug fix should include tests.
- Place test files next to the source: `foo.ts` → `foo.spec.ts`.
- Tests should be deterministic — no reliance on timing, network, or global state leakage.

## Coding Standards

### TypeScript

- **Strict mode** is enabled — no `any` unless absolutely necessary.
- Use `type` imports: `import type { Foo } from './foo'`.
- Follow the existing patterns in the package you're modifying.

### Formatting

- [Prettier](https://prettier.io/) handles all formatting. Run `pnpm format` before committing.
- [EditorConfig](https://editorconfig.org/) is configured — most editors pick this up automatically.

### Linting

- [ESLint](https://eslint.org/) with TypeScript rules. Run `pnpm lint` to check.
- Do not add `eslint-disable` comments. Fix the underlying issue instead.

## Reporting Issues

### Bug reports

Use the [bug report template](https://github.com/retemper/lodestar/issues/new?template=bug_report.yml). Please include:

- A **minimal reproduction** (repository link or code snippet).
- Expected vs. actual behavior.
- Environment details (Node.js version, OS).

### Feature requests

Use the [feature request template](https://github.com/retemper/lodestar/issues/new?template=feature_request.yml). Please explain:

- The **problem** you're trying to solve (not just the solution you want).
- Any alternatives you've considered.

### Questions

For general questions, use [GitHub Discussions](https://github.com/retemper/lodestar/discussions) instead of opening an issue.

---

Thank you for contributing to lodestar!
