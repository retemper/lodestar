---
name: verify
description: Runs the full build/test/lint verification pipeline to catch CI failures locally
argument-hint: '[build|type-check|lint|test|lodestar|format|all (default: all)]'
---

# verify

Runs the full Turbo-based verification pipeline locally, mirroring what CI checks. Catches failures before push.

## Execution Flow

### 1. Determine scope

Parse `$ARGUMENTS` to decide which checks to run:

| Argument     | Steps executed                                         |
| ------------ | ------------------------------------------------------ |
| `all` or omit| build → type-check → lint → test → lodestar → format  |
| `build`      | build only                                             |
| `type-check` | build → type-check                                    |
| `lint`       | lint only                                              |
| `test`       | build → test                                           |
| `lodestar`   | build → lodestar                                       |
| `format`     | format:check only                                      |

### 2. Run verification steps

Execute in dependency order. Stop on first failure unless running `all` (in which case, collect all failures and report at the end).

#### 2-1. Build

```bash
pnpm turbo build
```

#### 2-2. Type check

```bash
pnpm turbo type-check
```

#### 2-3. Lint

```bash
pnpm turbo lint
```

#### 2-4. Test

```bash
pnpm turbo test
```

#### 2-5. Lodestar (architecture rules)

```bash
pnpm turbo lodestar
```

#### 2-6. Format check

```bash
pnpm format:check
```

### 3. Report results

Output a summary table:

```
## Verification Results

| Step       | Status | Duration |
|------------|--------|----------|
| build      | ✅ Pass | 12s     |
| type-check | ✅ Pass | 8s      |
| lint       | ❌ Fail | 3s      |
| test       | ✅ Pass | 15s     |
| lodestar   | ✅ Pass | 2s      |
| format     | ✅ Pass | 1s      |

Total: 5/6 passed, 1 failed
```

### 4. Auto-fix (on failure)

If a step fails:

- **lint failure**: Ask the user if they want to attempt auto-fix with `pnpm turbo lint -- --fix`.
- **format failure**: Ask the user if they want to auto-fix with `pnpm format`.
- **type-check / test / build failure**: Show the error output and suggest fixes.
- **lodestar failure**: Show which architecture rules were violated and the relevant rule documentation.

## Notes

- `build` must complete before `type-check`, `test`, and `lodestar` (they depend on build outputs in `dist/`)
- `lint` and `format:check` have no build dependency and can conceptually run independently
- Turbo caching is active — unchanged packages skip re-execution
- This mirrors the CI pipeline in `.github/workflows/ci.yml`
