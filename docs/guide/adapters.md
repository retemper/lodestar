---
description: 'Overview of Lodestar adapters — generate ESLint, Prettier, Biome, and other tool configs from one source.'
---

# Adapters

Adapters are integrations with external tools -- linters, formatters, and git hooks -- declared in `lodestar.config.ts`. They let you centralize tool configuration in a single source of truth while generating the native config files that each tool and IDE expects.

```sh
pnpm add -D @retemper/lodestar-adapter-eslint @retemper/lodestar-adapter-prettier @retemper/lodestar-adapter-biome @retemper/lodestar-adapter-husky @retemper/lodestar-adapter-lint-staged @retemper/lodestar-adapter-commitlint @retemper/lodestar-adapter-knip @retemper/lodestar-adapter-stylelint
```

## The ToolAdapter Interface

Every adapter implements the `ToolAdapter` interface from `@retemper/lodestar-types`:

```ts
interface ToolAdapter<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  check?(rootDir: string, include: readonly string[]): Promise<readonly Violation[]>;
  fix?(rootDir: string, include: readonly string[]): Promise<void>;
  generateConfig?(): Promise<unknown[]>;
  verifySetup?(rootDir: string): Promise<readonly Violation[]>;
  setup?(rootDir: string): Promise<void>;
}
```

| Method           | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `check`          | Run the tool and return violations (linters, formatters)                       |
| `fix`            | Auto-fix issues -- `--fix` for linters, `--write` for formatters               |
| `generateConfig` | Build the native config object for IDE/editor integration                      |
| `verifySetup`    | Detect missing or drifted config files and return setup violations             |
| `setup`          | Create tool infrastructure (git hooks, CI config) -- called by `lodestar init` |

## Adding Adapters to Config

Adapters are placed in the `adapters` array inside a config block:

```ts
import { defineConfig } from '@retemper/lodestar-types';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] }), prettierAdapter({ singleQuote: true })],
});
```

## Setup Verification Flow

When you run `lodestar check`, adapters participate in a two-phase process:

1. **Verify setup** -- each adapter's `verifySetup` is called first. It checks that the managed config files exist and match the lodestar config. Missing or drifted files produce violations.

2. **Run checks** -- if setup is valid, `check` runs the actual tool (ESLint, Prettier, Biome).

Running `lodestar check --fix` applies the auto-fix for setup violations -- creating or updating the managed config files -- before running tool checks.

## Available Adapters

| Adapter                                      | Package                                  | Managed File         | Description                          |
| -------------------------------------------- | ---------------------------------------- | -------------------- | ------------------------------------ |
| [adapter-eslint](/adapters/eslint)           | `@retemper/lodestar-adapter-eslint`      | `eslint.config.js`   | ESLint via Node API with bridge file |
| [adapter-prettier](/adapters/prettier)       | `@retemper/lodestar-adapter-prettier`    | `.prettierrc`        | Prettier via CLI                     |
| [adapter-biome](/adapters/biome)             | `@retemper/lodestar-adapter-biome`       | `biome.json`         | Biome via CLI with temp config       |
| [adapter-husky](/adapters/husky)             | `@retemper/lodestar-adapter-husky`       | `.husky/<hook>`      | Git hooks via Husky                  |
| [adapter-lint-staged](/adapters/lint-staged) | `@retemper/lodestar-adapter-lint-staged` | `.lintstagedrc.json` | Staged file linting                  |
| [adapter-commitlint](/adapters/commitlint)   | `@retemper/lodestar-adapter-commitlint`  | `.commitlintrc.json` | Commit message conventions           |
| [adapter-knip](/adapters/knip)               | `@retemper/lodestar-adapter-knip`        | `knip.json`          | Unused exports/dependencies          |
| [adapter-stylelint](/adapters/stylelint)     | `@retemper/lodestar-adapter-stylelint`   | `.stylelintrc.json`  | CSS/SCSS linting                     |
