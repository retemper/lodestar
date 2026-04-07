# adapter-commitlint

Generates a `.commitlintrc.json` config file for commit message linting. This is a setup-only adapter: commitlint is invoked by husky, not by lodestar directly.

**Package:** `@lodestar/adapter-commitlint`

**Managed file:** `.commitlintrc.json`

## Config Options

| Option    | Type                      | Description                                                                    |
| --------- | ------------------------- | ------------------------------------------------------------------------------ |
| `extends` | `string[]`                | Shareable configs to extend -- e.g., `'@commitlint/config-conventional'`       |
| `rules`   | `Record<string, unknown>` | Custom rules -- e.g., `{"type-enum": [2, "always", ["feat", "fix", "chore"]]}` |

All options are optional. Calling `commitlintAdapter()` with no arguments produces an empty config.

## Example

```ts
import { commitlintAdapter } from '@lodestar/adapter-commitlint';

commitlintAdapter({
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'refactor', 'test']],
    'subject-case': [2, 'always', 'lower-case'],
  },
});
```

## How verifySetup Works

1. Checks that `.commitlintrc.json` exists in `rootDir`.
2. Reads the file content and compares it against the JSON that lodestar config produces.
3. Returns a **missing** violation if the file does not exist.
4. Returns a **drift** violation (with a diff of expected vs actual) if the content does not match.
5. Returns no violations if `.commitlintrc.json` matches.

Drift means the `.commitlintrc.json` file was manually edited or overwritten by another tool, so it no longer reflects the lodestar config. Running `lodestar check --fix` regenerates the file to resolve the violation.

> **Note:** This adapter does not implement `check()`. commitlint is triggered by husky git hooks (e.g., `commit-msg`), not by `lodestar check`.
