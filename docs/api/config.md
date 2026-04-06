# Config File Reference

## `defineConfig(config)`

Type-safe helper for creating `lodestar.config.ts`. Accepts a single config block or an array of blocks (flat config).

```ts
import { defineConfig } from 'lodestar';

export default defineConfig({
  plugins: [...],
  rules: { ... },
  adapters: [...],
});
```

## `WrittenConfig`

A config can be either a single `WrittenConfigBlock` or an array of blocks. The array form (flat config) enables file-scoped rules via the `files` field on each block.

```ts
type WrittenConfig = WrittenConfigBlock | readonly WrittenConfigBlock[];
```

## `WrittenConfigBlock`

Each block is the unit of flat config:

```ts
interface WrittenConfigBlock {
  /** Glob patterns for files this block applies to -- omit for global */
  readonly files?: readonly string[];
  /** Glob patterns for files to exclude from this block */
  readonly ignores?: readonly string[];
  /** Plugins that provide rules */
  readonly plugins?: readonly PluginEntry[];
  /** Rule configurations -- severity shorthand or full config */
  readonly rules?: Readonly<Record<string, Severity | WrittenRuleConfig>>;
  /** External tool adapters */
  readonly adapters?: readonly ToolAdapter[];
}
```

## `WrittenRuleConfig`

```ts
interface WrittenRuleConfig {
  readonly severity: 'error' | 'warn' | 'off';
  readonly options?: Readonly<Record<string, unknown>>;
}
```

Rules can be configured with a severity shorthand string or the full object form:

```ts
rules: {
  // Shorthand -- severity only
  'architecture/no-circular': 'error',

  // Full form -- severity with options
  'architecture/layers': {
    severity: 'error',
    options: {
      layers: [
        { name: 'domain', path: 'src/domain/**' },
        { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      ],
    },
  },
}
```

## `PluginEntry`

Plugins can be referenced in several ways:

```ts
type PluginEntry =
  | PluginFactory              // factory function (preferred)
  | Plugin                     // direct plugin object
  | [PluginFactory, options]   // factory with options
  | [string, options]          // string name with options (legacy)
  | string;                    // string name (legacy)
```

Example:

```ts
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  // ...
});
```

## Adapters

The `adapters` field attaches external tool adapters (linters, formatters, git hooks) to a config block. Each adapter implements the `ToolAdapter` interface:

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

Example with all three official adapters:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';
import { eslintAdapter } from '@lodestar/adapter-eslint';
import { prettierAdapter } from '@lodestar/adapter-prettier';
import { huskyAdapter } from '@lodestar/adapter-husky';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/no-circular': 'error',
  },
  adapters: [
    eslintAdapter({
      presets: ['strict'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
      },
    }),
    prettierAdapter({
      singleQuote: true,
      trailingComma: 'all',
      semi: true,
    }),
    huskyAdapter({
      hooks: {
        'pre-commit': ['npx lodestar check'],
      },
    }),
  ],
});
```

Adapters are deduplicated by `name` during config resolution -- if multiple blocks declare the same adapter, the last one wins.

## Flat Config (Multiple Blocks)

The array form allows different rules or adapters for different file sets. Blocks without `files` apply globally; blocks with `files` apply only to matching paths:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig([
  // Global block -- applies to all files
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },

  // Scoped block -- applies only to matching files
  {
    files: ['src/domain/**'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**' },
            { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          ],
        },
      },
    },
  },
]);
```

## Workspace Config Inheritance

In a monorepo, the root `lodestar.config.ts` is loaded first. When running in workspace mode (`lodestar check --workspace`), lodestar discovers packages via `pnpm-workspace.yaml` or `package.json` workspaces and runs rules against each package.

Each package can have its own `lodestar.config.ts` that overrides or extends the root config. If a package does not have its own config, the root config is used with the package directory as the resolution base.

Config resolution during workspace mode:

1. Root config is loaded from the monorepo root
2. Packages are discovered via workspace globs
3. For each package, lodestar checks for a local `lodestar.config.ts`
4. If found, the local config is resolved relative to the package directory
5. If not found, the root config is resolved relative to the package directory
