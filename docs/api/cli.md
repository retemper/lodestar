---
description: 'Lodestar CLI reference — check, init, graph, and impact commands with all available flags.'
---

# CLI Reference

## `lodestar check`

Run all configured rules against the project.

```sh
npx lodestar check [options]
```

| Flag             | Type                | Default       | Description                                                                                                            |
| ---------------- | ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--format`       | `string`            | `console`     | Output format. Choices: `console`, `json`, `sarif`, `junit`                                                            |
| `--workspace`    | `boolean`           | auto-detected | Force workspace mode on                                                                                                |
| `--no-workspace` | `boolean`           |               | Disable workspace mode                                                                                                 |
| `--rule`         | `string[]`          | all rules     | Only run specific rules. Supports exact match (`naming-convention/file-naming`) and prefix wildcard (`architecture/*`) |
| `--fix`          | `boolean`           | `false`       | Auto-fix violations where possible                                                                                     |
| `--cache`        | `boolean`           | `true`        | Enable disk caching for faster re-runs                                                                                 |
| `--clear-cache`  | `boolean`           | `false`       | Clear the cache before running                                                                                         |
| `--changed`      | `string \| boolean` |               | Only check files changed since the given git ref (or HEAD if no ref given). Computes transitive impact scope           |
| `--concurrency`  | `number`            | `4`           | Number of packages to check in parallel (workspace mode only)                                                          |

When `--workspace` is omitted, workspace mode is auto-detected by checking whether `pnpm-workspace.yaml` or `package.json` workspaces are present. When running in workspace mode, lodestar runs rules against each discovered package and the root, then prints an aggregated summary.

The `--rule` flag accepts one or more rule identifiers. A trailing `/*` matches all rules under that prefix:

```sh
# Run a single rule
npx lodestar check --rule architecture/no-circular

# Run all architecture rules
npx lodestar check --rule "architecture/*"

# Run multiple specific rules
npx lodestar check --rule architecture/layers --rule naming-convention/file-naming
```

### Incremental checking

The `--changed` flag enables incremental mode. Lodestar computes which files are affected by the changes (transitive dependents via the module graph) and only checks those files:

```sh
# Check files changed since HEAD (uncommitted changes)
npx lodestar check --changed

# Check files changed since a specific branch or commit
npx lodestar check --changed main
npx lodestar check --changed abc1234
```

### Caching

Lodestar caches rule results on disk. Files that haven't changed since the last run are skipped automatically:

```sh
# Caching is enabled by default
npx lodestar check

# Disable caching
npx lodestar check --no-cache

# Clear cache and re-run from scratch
npx lodestar check --clear-cache
```

**Exit codes:**

| Code | Meaning                          |
| ---- | -------------------------------- |
| `0`  | No errors (warnings are allowed) |
| `1`  | One or more errors found         |

---

## `lodestar init`

Create a `lodestar.config.ts` file in the current directory.

```sh
npx lodestar init
```

Generates a starter config that imports `defineConfig` and `@retemper/lodestar-plugin-architecture`, with a sample `architecture/layers` rule pre-configured:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
        ],
      },
    },
  },
});
```

---

## `lodestar setup`

Run `verifySetup()` on all adapters and auto-fix issues where possible.

```sh
npx lodestar setup
```

This command loads `lodestar.config.ts`, collects all adapters that expose a `verifySetup` method, and runs them sequentially. For each violation returned by an adapter, if a `fix` is available it is applied automatically. This is useful for ensuring that tool configuration files (e.g., `.prettierrc`, git hooks) are in sync with the lodestar config.

---

## `lodestar graph`

Output the project dependency graph in a visual format.

```sh
npx lodestar graph [options]
```

| Flag       | Type      | Default   | Description                                                                                                     |
| ---------- | --------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `--scope`  | `string`  | all files | Only show files matching this path prefix (e.g., `src/domain`)                                                  |
| `--format` | `string`  | `mermaid` | Output format. Choices: `mermaid`, `dot`                                                                        |
| `--layers` | `boolean` | `false`   | Show layer-level architecture graph instead of file-level. Requires an `architecture/layers` rule in the config |
| `--serve`  | `boolean` | `false`   | Start interactive graph viewer in the browser                                                                   |
| `--port`   | `number`  | `4040`    | Port for the interactive graph server (used with `--serve`)                                                     |

**File-level mode** (default) outputs every import edge between source files. Use `--scope` to limit the output to a specific directory:

```sh
npx lodestar graph --scope src/domain
npx lodestar graph --format dot | dot -Tsvg -o deps.svg
```

**Layer-level mode** (`--layers`) aggregates file-level dependencies into layer-to-layer edges. Allowed imports are shown as solid arrows; violations are shown as dashed red lines with a "violation" label:

```sh
npx lodestar graph --layers
npx lodestar graph --layers --format dot
```

**Interactive mode** (`--serve`) starts a local HTTP server with a visual graph explorer. The viewer supports search, filtering, layer-based coloring, and node selection:

```sh
npx lodestar graph --serve
npx lodestar graph --serve --port 8080
```

---

## `lodestar watch`

Run rules in watch mode -- re-checks affected files on every save.

```sh
npx lodestar watch [options]
```

| Flag         | Type       | Default   | Description                                                                          |
| ------------ | ---------- | --------- | ------------------------------------------------------------------------------------ |
| `--format`   | `string`   | `console` | Output format. Choices: `console`, `json`                                            |
| `--rule`     | `string[]` | all rules | Only run specific rules. Supports exact match and prefix wildcard (`architecture/*`) |
| `--fix`      | `boolean`  | `false`   | Auto-fix violations where possible                                                   |
| `--cache`    | `boolean`  | `true`    | Enable disk caching for faster re-runs                                               |
| `--debounce` | `number`   | `300`     | Debounce interval in milliseconds                                                    |

On each file change, lodestar computes the transitive impact scope and re-runs only the affected rules. A summary is printed after each cycle:

```
Watch: 1 changed → 3 in scope | 0 errors, 0 warnings (42ms)
  Files: src/core/engine.ts
```

Stop with `Ctrl+C`.

---

## `lodestar impact <file>`

Show all files affected by changing a given file, using BFS over the dependents graph.

```sh
npx lodestar impact <file> [options]
```

| Flag      | Type      | Default      | Description                                       |
| --------- | --------- | ------------ | ------------------------------------------------- |
| `<file>`  | `string`  | **required** | Target file to analyze (relative to project root) |
| `--json`  | `boolean` | `false`      | Output as JSON instead of human-readable text     |
| `--depth` | `number`  | unlimited    | Maximum BFS traversal depth                       |

The default human-readable output lists direct dependents (depth 1) and transitive dependents (depth > 1) with their provenance path:

```sh
npx lodestar impact src/core/engine.ts
npx lodestar impact src/core/engine.ts --depth 2
npx lodestar impact src/core/engine.ts --json
```

JSON output structure:

```json
{
  "target": "src/core/engine.ts",
  "directDependents": ["src/cli/commands/check.ts"],
  "transitiveDependents": [{ "file": "src/cli/index.ts", "via": "src/cli/commands/check.ts" }],
  "totalAffected": 2
}
```
