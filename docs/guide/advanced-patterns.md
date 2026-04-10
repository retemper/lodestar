---
description: 'Advanced Lodestar patterns — conditional rules, shared configs, dynamic options, and multi-layer setups.'
---

# Advanced Patterns

Patterns for teams with more complex architectures, multi-package setups, or sophisticated enforcement needs.

## Shared Config Across Packages

In a monorepo, you may want consistent rules across packages without duplicating config. Extract a shared config factory:

```ts
// tools/lodestar-config/shared.ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import type { WrittenConfig } from '@retemper/lodestar';

export function createSharedConfig(overrides?: Partial<WrittenConfig>): WrittenConfig {
  return {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
      ...overrides?.rules,
    },
    ...overrides,
  };
}
```

Then use it in each package:

```ts
// packages/billing/lodestar.config.ts
import { defineConfig } from '@retemper/lodestar';
import { createSharedConfig } from '../../tools/lodestar-config/shared';

export default defineConfig(
  createSharedConfig({
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**' },
            { name: 'service', path: 'src/service/**', canImport: ['domain'] },
          ],
        },
      },
    },
  }),
);
```

## Feature Slices

For feature-sliced architecture, define each feature as a module with layers inside:

```ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/modules': {
      severity: 'error',
      options: {
        modules: ['src/features/auth', 'src/features/billing', 'src/features/dashboard'],
      },
    },
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'shared', path: 'src/shared/**' },
          {
            name: 'features',
            path: 'src/features/**',
            canImport: ['shared'],
          },
          {
            name: 'app',
            path: 'src/app/**',
            canImport: ['features', 'shared'],
          },
        ],
      },
    },
  },
});
```

This enforces:

- Features cannot import each other directly (module encapsulation)
- Features can only import from `shared`
- Only the `app` layer can compose features together

## Type-Only Import Exceptions

Some architectures allow type imports across boundaries (e.g., domain types used in infra for serialization). Enable this per-rule:

```ts
'architecture/layers': {
  severity: 'error',
  options: {
    allowTypeOnly: true,
    layers: [
      { name: 'domain', path: 'src/domain/**' },
      { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
    ],
  },
}
```

With `allowTypeOnly: true`, `import type { User } from '../domain/user'` is allowed even when the runtime import would be forbidden.

## Scoped Rules with Flat Config

Use flat config (array form) to apply different rules to different parts of your codebase:

```ts
export default defineConfig([
  // Global rules — apply everywhere
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },
  // Backend-specific rules
  {
    files: ['src/server/**'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'routes', path: 'src/server/routes/**' },
            { name: 'services', path: 'src/server/services/**', canImport: ['routes'] },
            { name: 'db', path: 'src/server/db/**', canImport: ['services'] },
          ],
        },
      },
    },
  },
  // Ignore test files for module rules
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    rules: {
      'architecture/modules': {
        severity: 'error',
        options: { modules: ['src/auth', 'src/billing'] },
      },
    },
  },
]);
```

## Controlling Circular Dependency Detection

For large codebases, fine-tune circular dependency checks:

```ts
'architecture/no-circular': {
  severity: 'error',
  options: {
    // Only scan source files, not tests or generated code
    entries: ['src/**/*.ts'],
    ignore: ['**/*.spec.ts', '**/*.test.ts', 'src/generated/**'],
    // Only report short cycles (long chains are often false positives)
    maxDepth: 5,
  },
}
```

## Workspace-Level Package Checks

Use `architecture/no-circular-packages` to prevent circular dependencies between workspace packages:

```ts
// Root lodestar.config.ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/no-circular-packages': {
      severity: 'error',
      options: {
        scope: '@myorg', // treats @myorg/* packages as internal
      },
    },
  },
});
```

This reads `dependencies` and `devDependencies` from each package's `package.json` and reports any circular chains at the package level.

## Combining Architecture Rules with Adapters

A full config combining architecture enforcement with tool setup:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';
import { huskyAdapter } from '@retemper/lodestar-adapter-husky';
import { lintStagedAdapter } from '@retemper/lodestar-adapter-lint-staged';
import { commitlintAdapter } from '@retemper/lodestar-adapter-commitlint';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
        ],
      },
    },
    'architecture/no-circular': 'error',
    'architecture/modules': {
      severity: 'error',
      options: { modules: ['src/domain', 'src/application'] },
    },
  },
  adapters: [
    eslintAdapter({ presets: ['strict'] }),
    prettierAdapter({ singleQuote: true, printWidth: 100 }),
    huskyAdapter({
      hooks: { 'pre-commit': ['npx lint-staged'], 'commit-msg': ['npx commitlint --edit "$1"'] },
    }),
    lintStagedAdapter({
      commands: { '*.{ts,tsx}': 'eslint --fix', '*.{ts,tsx,json,md}': 'prettier --write' },
    }),
    commitlintAdapter({ extends: ['@commitlint/config-conventional'] }),
  ],
});
```

This single config governs:

- Architecture rules (layers, circular dependencies, module encapsulation)
- Linting (ESLint) and formatting (Prettier)
- Git hooks (Husky) and staged file checks (lint-staged)
- Commit message format (commitlint)
