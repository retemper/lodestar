# adapter-biome

Runs Biome via the CLI and generates a `biome.json` config file.

**Package:** `@lodestar/adapter-biome`

**Managed file:** `biome.json`

## Config Options

| Option    | Type                                | Description                                                                  |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `rules`   | `Record<string, BiomeRuleSeverity>` | Rule overrides -- keys are `group/rule` (e.g., `"style/noNonNullAssertion"`) |
| `ignore`  | `string[]`                          | Glob patterns to ignore                                                      |
| `extends` | `string`                            | Path to existing biome.json to extend                                        |
| `bin`     | `string`                            | Binary name or path (default: `"biome"`)                                     |

`BiomeRuleSeverity` is `'error' | 'warn' | 'info' | 'off'`.

## Example

```ts
import { biomeAdapter } from '@lodestar/adapter-biome';

biomeAdapter({
  rules: {
    'style/noNonNullAssertion': 'error',
    'suspicious/noExplicitAny': 'warn',
  },
  ignore: ['dist/**', 'node_modules/**'],
  extends: './biome-base.json',
});
```

## Temporary Config File

During `check`, the biome adapter does not use the project's `biome.json` directly. Instead it:

1. Writes a temporary config file (`.lodestar-biome-tmp.json`) derived from the lodestar config.
2. Runs `biome lint --reporter=json` with the temporary config.
3. Parses the JSON diagnostics into lodestar `Violation` objects.
4. Cleans up the temporary file after the run completes.

This approach avoids conflicts with an existing `biome.json` and ensures the lodestar config is always the source of truth during checks.

## How verifySetup Works

1. Checks that `biome.json` exists in `rootDir`.
2. Reads the file content and compares it against the config that lodestar would generate.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `biome.json` matches.

Running `lodestar check --fix` regenerates `biome.json` to resolve setup violations.
