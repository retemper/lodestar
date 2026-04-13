# CLAUDE.md — Lodestar

Declarative project governance framework for monorepos.
Enforce architecture rules (layers, module boundaries, dependencies) via config.

## Language policy

**All written output MUST be in English.** This is a global open-source project.

- Code: variable names, function names, comments, JSDoc, error messages
- Git: commit messages, branch names, PR titles and descriptions
- Docs: README, CONTRIBUTING, CHANGELOG, inline documentation
- Issues & discussions: titles, descriptions, replies
- Code review: all review comments in English

No exceptions. Non-English text must not appear in any artifact that enters the repository.

## Quick reference

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build all | `pnpm turbo build` |
| Type-check | `pnpm turbo type-check` |
| Test | `pnpm turbo test -- --coverage` |
| Lint | `pnpm turbo lint` |
| Format check | `pnpm format:check` |
| Format fix | `pnpm format` |
| Architecture check | `pnpm turbo lodestar` |
| Single package | `pnpm turbo <task> --filter=@retemper/<pkg>` |

## Project structure

Monorepo: pnpm workspaces + Turborepo.

```
packages/     — core libraries (types, config, core, cli, accel, lodestar)
plugins/      — rule plugins (structure, boundary, deps, content)
internal/     — shared internal config
examples/     — usage examples
docs/         — VitePress documentation
```

**Dependency direction:** `lodestar → core → config → types`. Plugins depend on `types` only.

## Code conventions

- TypeScript strict mode — avoid `any`
- Use `import type` for type-only imports
- Prettier: printWidth=100, singleQuote, trailingComma=all
- Test files: colocated as `foo.spec.ts`
- No `eslint-disable` comments — fix the underlying issue
- Prefer minimal dependencies — implement small utilities inline

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
Scope: package name without `@retemper/lodestar-` prefix (e.g., `core`, `cli`, `plugin-structure`)

## PR guidelines

- One logical change per PR
- PR title follows conventional commit format (squash-merge)
- Include tests for code changes
- Add a changeset (`pnpm changeset`) if published package behavior changes
- All checks must pass before merge

## Architecture rules

The repo enforces its own architecture via `lodestar.config.ts`:

- `architecture/no-circular-packages` — no circular dependencies between packages
- `architecture/modules` — module encapsulation for core internals
- `structure/no-forbidden-path` — no `.env`, `.log` files
- `structure/co-change-required` — types changes must update test-utils

Pre-push hook runs full verification: build, type-check, lodestar, test.
