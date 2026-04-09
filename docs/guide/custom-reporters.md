---
description: 'Create custom Lodestar reporters to format check results as JSON, HTML, or any output format.'
---

# Custom Reporters

Reporters control how lodestar displays results. Lodestar ships with two built-in reporters (`console` and `json`) and lets you write your own.

## Built-in Reporters

| Reporter  | Flag                  | Output | Use Case                              |
| --------- | --------------------- | ------ | ------------------------------------- |
| `console` | (default)             | stderr | Human-readable terminal output        |
| `json`    | `--format json`       | stdout | Machine-readable for CI pipelines     |

## Reporter Interface

```ts
interface Reporter {
  readonly name: string;
  onStart(config: { rootDir: string; ruleCount: number }): void;
  onRuleStart?(ruleId: string): void;
  onRuleComplete?(result: RuleResultSummary): void;
  onViolation(violation: Violation): void;
  onComplete(summary: RunSummary): void;
}
```

### Lifecycle

1. **`onStart`** — Called once before any rules run. Receives the root directory and total rule count.
2. **`onRuleStart`** — _(optional)_ Called before each rule begins.
3. **`onViolation`** — Called each time a rule reports a violation.
4. **`onRuleComplete`** — _(optional)_ Called after each rule finishes. Receives violations, duration, and metadata.
5. **`onComplete`** — Called after all rules finish. Receives the full summary.

### Key Types

```ts
interface RuleResultSummary {
  readonly ruleId: string;
  readonly violations: readonly Violation[];
  readonly durationMs: number;
  readonly meta?: string;      // e.g., "14 files", "0 cycles"
  readonly docsUrl?: string;
  readonly error?: Error;
}

interface RunSummary {
  readonly totalFiles: number;
  readonly totalRules: number;
  readonly violations: readonly Violation[];
  readonly ruleResults: readonly RuleResultSummary[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly durationMs: number;
}
```

## Writing a Custom Reporter

### Minimal Example

```ts
import type { Reporter, RunSummary } from '@retemper/lodestar';

function createMyReporter(): Reporter {
  return {
    name: 'my-reporter',

    onStart({ ruleCount }) {
      console.error(`Running ${ruleCount} rules...`);
    },

    onRuleComplete(result) {
      const status = result.violations.length === 0 ? 'PASS' : 'FAIL';
      console.error(`  [${status}] ${result.ruleId} (${result.durationMs}ms)`);
    },

    onViolation(violation) {
      const loc = violation.location ? ` at ${violation.location.file}` : '';
      console.error(`    ${violation.severity}: ${violation.message}${loc}`);
    },

    onComplete(summary) {
      console.error(
        `Done: ${summary.errorCount} errors, ${summary.warnCount} warnings in ${summary.durationMs}ms`,
      );
    },
  };
}
```

### JUnit XML Reporter

A reporter that produces JUnit XML for CI systems:

```ts
import type { Reporter, RuleResultSummary, RunSummary, Violation } from '@retemper/lodestar';

function createJUnitReporter(): Reporter {
  const results: RuleResultSummary[] = [];

  return {
    name: 'junit',

    onStart() {},

    onViolation() {},

    onRuleComplete(result) {
      results.push(result);
    },

    onComplete(summary) {
      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<testsuites tests="${summary.totalRules}" failures="${summary.errorCount}" time="${(summary.durationMs / 1000).toFixed(3)}">`,
        '  <testsuite name="lodestar">',
      ];

      for (const result of results) {
        if (result.violations.length === 0) {
          lines.push(`    <testcase name="${result.ruleId}" time="${(result.durationMs / 1000).toFixed(3)}" />`);
        } else {
          lines.push(`    <testcase name="${result.ruleId}" time="${(result.durationMs / 1000).toFixed(3)}">`);
          for (const v of result.violations) {
            const loc = v.location ? `${v.location.file}:${v.location.line ?? 0}` : '';
            lines.push(`      <failure message="${escapeXml(v.message)}" type="${v.severity}">${escapeXml(loc)}</failure>`);
          }
          lines.push('    </testcase>');
        }
      }

      lines.push('  </testsuite>', '</testsuites>');
      console.log(lines.join('\n'));
    },
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

## Using a Custom Reporter

Pass your reporter to the `run()` function:

```ts
import { run, loadConfigFile, resolveConfig } from '@retemper/lodestar';

const written = await loadConfigFile('lodestar.config.ts');
const config = await resolveConfig(written);

const summary = await run({
  config,
  reporter: createMyReporter(),
});
```

## Workspace Reporter

For monorepo support, extend the reporter with workspace callbacks:

```ts
interface WorkspaceReporter extends Reporter {
  onPackageStart?(pkg: WorkspacePackage): void;
  onPackageComplete?(pkg: WorkspacePackage, summary: RunSummary): void;
}

interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}
```

These callbacks fire before and after each package in a workspace run.
