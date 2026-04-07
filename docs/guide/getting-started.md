# Getting Started

## Installation

```sh
npm install -D lodestar @retemper/lodestar-plugin-architecture
```

## Initialize Config

```sh
npx lodestar init
```

This creates a `lodestar.config.ts`:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

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
  },
});
```

## Add Rules

Configure rules in the `rules` object. Each rule is prefixed with its plugin namespace:

```ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    // Full form — severity + options
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
        ],
      },
    },
    // Shorthand — just the severity
    'architecture/no-circular': 'error',
    // Module encapsulation
    'architecture/modules': {
      severity: 'error',
      options: { modules: ['src/domain', 'src/billing'] },
    },
  },
});
```

## Run Checks

```sh
npx lodestar check
```

Output:

```
  lodestar check

  ✗ architecture/layers
    Layer "domain" cannot import from "infra" — not listed in canImport
    at src/domain/entity.ts:5

  ✗ architecture/no-circular
    Circular dependency detected starting from "src/a.ts"
    at src/a.ts

  2 errors, 0 warnings
```

## Visualize

```sh
npx lodestar graph --layers
```

Shows your declared architecture as a Mermaid diagram with actual dependency counts. Violations appear as dashed lines.

## Add to CI

```yaml
# .github/workflows/ci.yml
- run: npx lodestar check
```

Any violation with severity `error` causes a non-zero exit code.

## Next Steps

- [Rules](/guide/rules) — How rules work
- [Plugins](/guide/plugins) — Browse official plugins
- [Configuration](/guide/configuration) — Full config reference
- [Workspace Mode](/guide/workspace) — Monorepo support
