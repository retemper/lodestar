# @retemper/cli

Command-line interface for the Lodestar architecture rule engine.

## Installation

```sh
pnpm add -D @retemper/cli
```

Or run directly:

```sh
npx lodestar check
```

## Commands

### `lodestar check`

Run architecture rule checks against the current project.

```sh
# Basic check
lodestar check

# JSON output (for CI integration)
lodestar check --format json

# Explicit workspace mode (auto-detected by default)
lodestar check --workspace
```

**Options:**

| Flag          | Default   | Description                                        |
| ------------- | --------- | -------------------------------------------------- |
| `--format`    | `console` | Output format: `console` or `json`                 |
| `--workspace` | auto      | Run in workspace mode across all monorepo packages |

### `lodestar init`

Scaffold a `lodestar.config.ts` file in the current directory.

```sh
lodestar init
```

## Programmatic API

```ts
import {
  checkCommand,
  initCommand,
  createConsoleReporter,
  createJsonReporter,
} from '@retemper/cli';
```

| Export                  | Description                            |
| ----------------------- | -------------------------------------- |
| `createCli`             | Create the full yargs CLI instance     |
| `checkCommand`          | Handler for the `check` command        |
| `initCommand`           | Handler for the `init` command         |
| `createConsoleReporter` | Human-readable console output reporter |
| `createJsonReporter`    | Machine-readable JSON output reporter  |
