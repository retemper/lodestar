# adapter-knip

Runs Knip via the CLI and parses JSON output to find unused files, dependencies, and exports. Also generates a `knip.json` config file.

**Package:** `@retemper/adapter-knip`

**Managed file:** `knip.json`

## Config Options

| Option               | Type       | Description                             |
| -------------------- | ---------- | --------------------------------------- |
| `entry`              | `string[]` | Entry file patterns                     |
| `project`            | `string[]` | Project file patterns                   |
| `ignore`             | `string[]` | Glob patterns to ignore                 |
| `ignoreDependencies` | `string[]` | Dependency names to ignore              |
| `bin`                | `string`   | Binary name or path (default: `"knip"`) |

All options are optional. Calling `knipAdapter()` with no arguments uses Knip defaults.

## Example

```ts
import { knipAdapter } from '@retemper/adapter-knip';

knipAdapter({
  entry: ['src/index.ts'],
  project: ['src/**/*.ts'],
  ignore: ['src/generated/**'],
  ignoreDependencies: ['@types/node'],
});
```

## How verifySetup Works

1. Checks that `knip.json` exists in `rootDir`.
2. Reads the file content and compares it against the JSON that lodestar config produces.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `knip.json` matches.

Drift means the `knip.json` file was manually edited or overwritten by another tool, so it no longer reflects the lodestar config. Running `lodestar check --fix` regenerates the file to resolve the violation.

## How check Works

The adapter runs `knip --reporter json` in the project root and parses the JSON output. It produces three categories of violations:

| Rule ID                  | Severity | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `knip/unused-file`       | `warn`   | A file is not referenced by any entry    |
| `knip/unused-dependency` | `warn`   | A dependency in `package.json` is unused |
| `knip/unused-export`     | `warn`   | An exported symbol is never imported     |

Example violation output:

```
warn  knip/unused-file        Unused file: src/legacy/old-utils.ts
warn  knip/unused-dependency   Unused dependency: lodash
warn  knip/unused-export       Unused export "helperFn" in src/utils.ts
```
