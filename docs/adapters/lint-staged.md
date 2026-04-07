# adapter-lint-staged

Generates a `.lintstagedrc.json` config file that maps glob patterns to commands. This is a setup-only adapter: lint-staged is invoked by husky, not by lodestar directly.

**Package:** `@lodestar/adapter-lint-staged`

**Managed file:** `.lintstagedrc.json`

## Config Options

| Option     | Type                                          | Description                                                         |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `commands` | `Record<string, string \| readonly string[]>` | Glob pattern to command mapping -- e.g., `{"*.ts": "eslint --fix"}` |

## Example

```ts
import { lintStagedAdapter } from '@lodestar/adapter-lint-staged';

lintStagedAdapter({
  commands: {
    '*.{ts,tsx}': 'eslint --fix',
    '*.{css,scss}': 'stylelint --fix',
    '*.{ts,tsx,css,scss,json,md}': 'prettier --write',
  },
});
```

## How verifySetup Works

1. Checks that `.lintstagedrc.json` exists in `rootDir`.
2. Reads the file content and compares it against the JSON that lodestar config produces from the `commands` mapping.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `.lintstagedrc.json` matches.

Drift means the `.lintstagedrc.json` file was manually edited or overwritten by another tool, so it no longer reflects the lodestar config. Running `lodestar check --fix` regenerates the file to resolve the violation.

> **Note:** This adapter does not implement `check()`. lint-staged is triggered by husky git hooks, not by `lodestar check`.
