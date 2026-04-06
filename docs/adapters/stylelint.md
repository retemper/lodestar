# adapter-stylelint

Runs Stylelint via the CLI and parses JSON output for CSS lint violations. Also generates a `.stylelintrc.json` config file.

**Package:** `@lodestar/adapter-stylelint`

**Managed file:** `.stylelintrc.json`

## Config Options

| Option    | Type                      | Description                                                        |
| --------- | ------------------------- | ------------------------------------------------------------------ |
| `extends` | `string[]`                | Shareable configs to extend -- e.g., `'stylelint-config-standard'` |
| `rules`   | `Record<string, unknown>` | Custom Stylelint rules                                             |
| `ignore`  | `string[]`                | Glob patterns to ignore (mapped to `ignoreFiles` in config)        |
| `include` | `string[]`                | File patterns to check (defaults to `**/*.css`)                    |
| `bin`     | `string`                  | Binary name or path (default: `"stylelint"`)                       |

All options are optional. Calling `stylelintAdapter()` with no arguments uses Stylelint defaults.

## Example

```ts
import { stylelintAdapter } from '@lodestar/adapter-stylelint';

stylelintAdapter({
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': true,
  },
  ignore: ['dist/**', 'node_modules/**'],
  include: ['src/**/*.css', 'src/**/*.scss'],
})
```

## How verifySetup Works

1. Checks that `.stylelintrc.json` exists in `rootDir`.
2. Reads the file content and compares it against the JSON that lodestar config produces.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `.stylelintrc.json` matches.

Note that the `ignore` config option is mapped to the `ignoreFiles` key in the generated `.stylelintrc.json`.

Drift means the `.stylelintrc.json` file was manually edited or overwritten by another tool, so it no longer reflects the lodestar config. Running `lodestar check --fix` regenerates the file to resolve the violation.

## How check Works

The adapter runs `stylelint --formatter json` with the configured file patterns and parses the JSON output. Each Stylelint warning is mapped to a lodestar violation.

Violation rule IDs follow the format `stylelint/{rule-name}`, and severity is mapped directly from the Stylelint output (`error` stays `error`, everything else becomes `warn`).

Example violation output:

```
error  stylelint/color-no-invalid-hex                   Unexpected invalid hex color "#abz" (color-no-invalid-hex)
warn   stylelint/declaration-block-no-duplicate-properties  Unexpected duplicate "color" (declaration-block-no-duplicate-properties)
```

## Auto-fix

The adapter also implements `fix()`, which runs `stylelint --fix` on the configured file patterns. Running `lodestar check --fix` invokes this to auto-fix applicable Stylelint violations.
