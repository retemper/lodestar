# Commit Convention

lodestar uses [Conventional Commits](https://www.conventionalcommits.org/).

Since we squash-merge PRs, **the PR title** is what matters — it becomes the final commit message on `main`.

## Format

```
<type>(<scope>): <description>
```

### Type

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation only changes                              |
| `style`    | Formatting, missing semi colons, etc. (no code change)  |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | A code change that improves performance                 |
| `test`     | Adding or updating tests                                |
| `build`    | Changes to the build system or dependencies             |
| `ci`       | Changes to CI configuration                             |
| `chore`    | Other changes that don't modify src or test files       |
| `revert`   | Reverts a previous commit                               |

### Scope

The scope is the package name **without** the `@lodestar/` prefix:

- `types`, `config`, `core`, `cli`, `plugin-structure`, `plugin-boundary`, `plugin-deps`, `eslint`, `prettier`, `husky`, `tsconfig`, `accel`, `accel-typescript`, `accel-rust`, `accel-go`

For the `lodestar` facade package, use `lodestar` as the scope.

Scope is optional — omit it for changes that span multiple packages or affect the repo root.

### Description

- Start with a lowercase letter.
- Do not end with a period.
- Use imperative mood ("add feature" not "added feature").

## Validation Regex

```
/^(revert: )?(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?!?: .+/
```

## Examples

```
feat(core): add parallel rule execution strategy
fix(plugin-boundary): handle circular dependency detection
fix(plugin-deps): resolve false positive on optional peer deps
docs: update quick start guide
test(cli): add config resolution edge cases
refactor(config): extract schema validation into separate module
perf(core): lazy-load rule plugins on first check
build: update TypeScript to 5.7
ci: add Windows to test matrix
chore: clean up unused dev dependencies
```

## Breaking Changes

For breaking changes, add `!` after the type/scope:

```
feat(core)!: change rule execution result type
```

Or include `BREAKING CHANGE:` in the commit body.
