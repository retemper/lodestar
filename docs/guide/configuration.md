# Configuration

Lodestar is configured via a `lodestar.config.ts` file in your project root.

## Config File

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

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
  },
});
```

## File Formats

Lodestar looks for config files in this order:

1. `lodestar.config.ts`
2. `lodestar.config.mjs`
3. `lodestar.config.js`

## Config Block Properties

### `plugins`

Array of plugin instances. Plugins are imported as named exports:

```ts
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
});
```

### `rules`

Map of rule IDs to their configuration:

```ts
rules: {
  'rule-name': 'error',           // shorthand — severity only
  'rule-name': {                   // full form — severity + options
    severity: 'warn',
    options: { /* rule-specific */ },
  },
}
```

### `adapters`

Array of tool adapters. See the [Adapters guide](/guide/adapters) for details.

```ts
import { eslintAdapter } from '@lodestar/adapter-eslint';
import { prettierAdapter } from '@lodestar/adapter-prettier';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] }), prettierAdapter({ singleQuote: true })],
});
```

### `files` and `ignores`

Glob patterns to scope a config block to specific files. These are only meaningful in flat config (array form):

```ts
export default defineConfig([
  {
    // Global block — applies to all files
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },
  {
    // Scoped block — only applies to src/
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          /* ... */
        },
      },
    },
  },
]);
```

## Flat Config (Array Form)

Lodestar uses a flat config model. You can pass a single block or an array of blocks. Array form enables file-scoped rules via `files` and `ignores` on each block:

```ts
export default defineConfig([
  globalBlock, // no `files` — applies everywhere
  scopedBlock, // has `files` — applies only to matching paths
]);
```

Blocks are merged in order. Later blocks override earlier ones for the same rule.

## Workspace Mode

In a monorepo, each package can have its own `lodestar.config.ts`. Run `lodestar check --workspace` to check all packages. See [Workspace Mode](/guide/workspace) for details.
