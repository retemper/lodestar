# Reporters

Reporters control how Lodestar displays results. You can choose a built-in format via the CLI or configure reporters in the config file.

## CLI Formats

Use `--format` to select the output format:

```sh
npx lodestar check --format console   # default — human-readable output
npx lodestar check --format json      # structured JSON to stdout
npx lodestar check --format sarif     # SARIF 2.1.0 for GitHub/IDE integration
npx lodestar check --format junit     # JUnit XML for CI systems
```

## Built-in Reporters

| Format    | Package                              | Output | Use Case                                   |
| --------- | ------------------------------------ | ------ | ------------------------------------------ |
| `console` | `@retemper/lodestar-cli`             | stderr | Local development, human-readable          |
| `json`    | `@retemper/lodestar-cli`             | stdout | CI pipelines, programmatic consumption     |
| `sarif`   | `@retemper/lodestar-reporter-sarif`  | stdout | GitHub Code Scanning, VS Code SARIF viewer |
| `junit`   | `@retemper/lodestar-reporter-junit`  | stdout | Jenkins, GitLab CI, CircleCI test reports  |

## SARIF Reporter

[SARIF](https://sarifweb.azurewebsites.net/) (Static Analysis Results Interchange Format) is an OASIS standard for static analysis output. Use it for GitHub Code Scanning integration:

```sh
npx lodestar check --format sarif > results.sarif
```

The output includes rule definitions with documentation URLs, source locations, and severity mappings.

## JUnit Reporter

JUnit XML is widely supported by CI systems for test result visualization:

```sh
npx lodestar check --format junit > results.xml
```

Each rule becomes a test case. Violations are reported as failures (errors) or system-out (warnings).

## Config-based Reporters

You can also configure reporters in `lodestar.config.ts` for always-on output (e.g., always write a SARIF file alongside console output):

```ts
import { defineConfig } from '@retemper/lodestar';
import { sarifReporter } from '@retemper/lodestar-reporter-sarif';

export default defineConfig({
  plugins: [/* ... */],
  rules: { /* ... */ },
  reporters: [sarifReporter({ output: 'reports/lodestar.sarif' })],
});
```

Config-based reporters run **in addition to** the CLI format reporter, not instead of it.

## Custom Reporters

See the [Core API — Reporter](/api/core#reporter) section for the `Reporter` interface and a custom reporter example.
