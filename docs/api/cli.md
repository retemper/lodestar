# CLI Reference

## `lodestar check`

Run all configured rules against the project.

```sh
npx lodestar check [options]
```

| Flag             | Type       | Default       | Description                                                                                                            |
| ---------------- | ---------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--format`       | `string`   | `console`     | Output format. Choices: `console`, `json`                                                                              |
| `--workspace`    | `boolean`  | auto-detected | Force workspace mode on                                                                                                |
| `--no-workspace` | `boolean`  |               | Disable workspace mode                                                                                                 |
| `--rule`         | `string[]` | all rules     | Only run specific rules. Supports exact match (`naming-convention/file-naming`) and prefix wildcard (`architecture/*`) |
| `--fix`          | `boolean`  | `false`       | Auto-fix violations where possible                                                                                     |

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
import { defineConfig } from 'lodestar';
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
