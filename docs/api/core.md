# @retemper/lodestar-core

Rule engine, runner, plugin resolver, and providers.

```ts
import { run, runWorkspace, createProviders } from '@retemper/lodestar-core';
```

## `run(options)`

Run all rules against a single project.

```ts
const summary = await run({
  config: resolvedConfig,
  reporter: myReporter, // optional
  fix: true,            // optional -- auto-fix violations
  cache: cacheProvider, // optional -- disk cache provider
  scope: fileSet,       // optional -- Set<string> to limit checked files
});
```

Returns a `RunSummary`:

```ts
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

## `runWorkspace(options)`

Run rules in workspace mode (monorepo).

```ts
const summary = await runWorkspace({
  rootDir: '/monorepo/root',
  rootConfig: writtenConfig,
  reporter: workspaceReporter, // optional
  fix: true,                   // optional
  cache: cacheProvider,        // optional
  concurrency: 4,              // optional -- parallel package limit (default: 4)
});
```

Returns a `WorkspaceSummary` with per-package results.

## `createProviders(rootDir)`

Create the provider map for a given root directory.

```ts
const providers = createProviders('/project/root');
// providers.fs, providers.graph, providers.ast, providers.config
```

## `createLogger(options?)`

Create a structured logger with level filtering.

```ts
import { createLogger, silentLogger } from '@retemper/lodestar-core';

const logger = createLogger({ level: 'warn' }); // only warn + error
logger.info('skipped');  // not printed
logger.error('printed'); // printed to stderr
```

| Option  | Type       | Default  | Description                                    |
| ------- | ---------- | -------- | ---------------------------------------------- |
| `level` | `LogLevel` | `'info'` | Minimum level to emit (`debug`, `info`, `warn`, `error`, `silent`) |
| `write` | `(msg: string) => void` | `process.stderr.write` | Custom output function |

`silentLogger` is a no-op logger that discards all messages. Useful for testing.

## `createDiskCacheProvider(rootDir)`

Create a file-system cache provider for rule result caching.

```ts
import { createDiskCacheProvider } from '@retemper/lodestar-core';

const cache = createDiskCacheProvider('/project/root');
await cache.clear(); // manually clear cache
```

The cache stores rule results keyed by file content hash. Unchanged files are skipped on subsequent runs.

## `createWatcher(options)`

Start watching a project for file changes and re-run rules on each change.

```ts
import { createWatcher } from '@retemper/lodestar-core';

const handle = createWatcher({
  config: resolvedConfig,
  debounceMs: 300,
  logger,
  onCycle(summary) {
    console.log(`${summary.changedFiles.length} changed, ${summary.errorCount} errors`);
  },
});

// Later: stop watching
handle.close();
```

## `getChangedFiles(rootDir, base?)`

Get files changed since a git ref using `git diff`.

```ts
import { getChangedFiles } from '@retemper/lodestar-core';

const files = await getChangedFiles('/project', 'main');
// ['src/a.ts', 'src/b.ts']
```

## `computeImpactScope(changedFiles, graph)`

Compute the transitive set of files affected by a list of changed files, using the module dependency graph.

```ts
import { computeImpactScope } from '@retemper/lodestar-core';

const scope = computeImpactScope(changedFiles, moduleGraph);
// Set<string> of all affected files
```

---

## Reporter

The `Reporter` interface formats and outputs rule execution progress and results. Lodestar ships with two built-in reporters (`console` and `json`), and you can create custom reporters by implementing this interface.

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

### Callback lifecycle

1. `onStart` -- called once before any rules run, with the project root and total rule count
2. `onRuleStart` -- called before each rule begins execution (optional)
3. `onViolation` -- called each time a rule reports a violation
4. `onRuleComplete` -- called after each rule finishes (optional)
5. `onComplete` -- called after all rules finish, with the aggregated `RunSummary`

### `RuleResultSummary`

Passed to `onRuleComplete` with per-rule details:

```ts
interface RuleResultSummary {
  readonly ruleId: string;
  readonly violations: readonly Violation[];
  readonly durationMs: number;
  readonly meta?: string; // e.g., "14 files", "0 cycles"
  readonly docsUrl?: string; // documentation URL for the rule
  readonly error?: Error; // set if the rule threw
}
```

## `WorkspaceReporter`

Extends `Reporter` with workspace-aware callbacks for monorepo runs:

```ts
interface WorkspaceReporter extends Reporter {
  onPackageStart?(pkg: WorkspacePackage): void;
  onPackageComplete?(pkg: WorkspacePackage, summary: RunSummary): void;
}
```

Where `WorkspacePackage` is:

```ts
interface WorkspacePackage {
  readonly name: string; // package name from package.json
  readonly dir: string; // absolute path to the package directory
}
```

## Creating a Custom Reporter

A reporter is a plain object implementing the `Reporter` interface. Here is a minimal example:

```ts
import type { Reporter, Violation, RunSummary, RuleResultSummary } from '@retemper/lodestar';

function createMyReporter(): Reporter {
  return {
    name: 'my-reporter',

    onStart({ ruleCount }) {
      console.error(`Running ${ruleCount} rules...`);
    },

    onRuleComplete(result: RuleResultSummary) {
      const status = result.violations.length === 0 ? 'PASS' : 'FAIL';
      console.error(`  [${status}] ${result.ruleId} (${result.durationMs}ms)`);
    },

    onViolation(violation: Violation) {
      const loc = violation.location ? ` at ${violation.location.file}` : '';
      console.error(`    ${violation.severity}: ${violation.message}${loc}`);
    },

    onComplete(summary: RunSummary) {
      console.error(
        `Done: ${summary.errorCount} errors, ${summary.warnCount} warnings in ${summary.durationMs}ms`,
      );
    },
  };
}
```

### Built-in reporters

| Reporter                  | Output | Description                                                                                                                                      |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createConsoleReporter()` | stderr | Human-readable output with ANSI colors, per-rule pass/fail status, metadata, and durations. Implements `WorkspaceReporter` with package headers. |
| `createJsonReporter()`    | stdout | Collects all violations and writes a single JSON object on completion. Useful for CI pipelines and programmatic consumption.                     |

```ts
import { createConsoleReporter } from '@retemper/lodestar-cli';
import { createJsonReporter } from '@retemper/lodestar-cli';
```
