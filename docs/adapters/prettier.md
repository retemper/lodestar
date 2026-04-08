# adapter-prettier

Runs Prettier via the CLI (`prettier --check` / `prettier --write`) and generates a `.prettierrc` file.

**Package:** `@retemper/lodestar-adapter-prettier`

**Managed file:** `.prettierrc`

## Config Options

| Option           | Type                                     | Description                                 |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| `printWidth`     | `number`                                 | Line width (default: 80)                    |
| `tabWidth`       | `number`                                 | Spaces per indentation level (default: 2)   |
| `useTabs`        | `boolean`                                | Use tabs instead of spaces                  |
| `semi`           | `boolean`                                | Use semicolons                              |
| `singleQuote`    | `boolean`                                | Use single quotes                           |
| `trailingComma`  | `'all'` \| `'es5'` \| `'none'`           | Trailing commas                             |
| `bracketSpacing` | `boolean`                                | Spaces inside object braces                 |
| `arrowParens`    | `'always'` \| `'avoid'`                  | Parens for single arrow function args       |
| `endOfLine`      | `'lf'` \| `'crlf'` \| `'cr'` \| `'auto'` | Line ending style                           |
| `ignore`         | `string[]`                               | Glob patterns to ignore                     |
| `bin`            | `string`                                 | Binary name or path (default: `"prettier"`) |
| `include`        | `string[]`                               | File patterns to check                      |

## Example

```ts
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

prettierAdapter({
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  tabWidth: 2,
  printWidth: 100,
});
```

## How verifySetup Works

1. Checks that `.prettierrc` exists in `rootDir`.
2. Reads the file content and compares it against the JSON that lodestar config produces.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `.prettierrc` matches.

Drift means the `.prettierrc` file was manually edited or overwritten by another tool, so it no longer reflects the lodestar config. Running `lodestar check --fix` regenerates the file to resolve the violation.

## How check Works

The adapter runs Prettier via the CLI:

1. Executes `prettier --check` with the configured file patterns (or defaults to common file types).
2. Parses the output to identify files that are not formatted correctly.
3. Each unformatted file is reported as a `Violation` with rule ID `prettier/format`.

All formatting violations are reported with severity `'warn'`.

## Auto-fix

The adapter implements `fix()`, which runs `prettier --write` on the configured file patterns. Running `lodestar check --fix` invokes this to auto-format all files in place.
