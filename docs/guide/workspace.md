---
description: 'Run Lodestar across monorepo packages with automatic workspace discovery and per-package configs.'
---

# Workspace Mode

Lodestar supports monorepo workspace mode. Each package can have its own independent `lodestar.config.ts`.

## How It Works

1. **Root config** runs against the monorepo root (e.g., "all packages must have `src/`")
2. **Per-package configs** are discovered automatically and run scoped to each package
3. Package configs run **independently** — no implicit inheritance from root

## Setup

### Root Config

```ts
// lodestar.config.ts (monorepo root)
export default defineConfig({
  plugins: ['@retemper/lodestar-plugin-structure', '@retemper/lodestar-plugin-deps'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['packages/*/src'] },
    },
    'deps/no-circular': 'error',
  },
});
```

### Per-Package Config

```ts
// packages/core/lodestar.config.mjs
export default {
  plugins: ['@retemper/lodestar-plugin-structure'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['src/providers'] },
    },
  },
};
```

Each package config is standalone — only the rules defined in it apply.

## Running

```sh
# Auto-detects workspace mode when pnpm-workspace.yaml exists
npx lodestar check

# Explicit flags
npx lodestar check --workspace
npx lodestar check --no-workspace
```

## Package Discovery

Lodestar reads workspace patterns from:

- `pnpm-workspace.yaml` (`packages:` field)
- `package.json` (`workspaces` field)

Only packages that have their own `lodestar.config.ts` / `.mjs` / `.js` are checked in workspace mode. Packages without a config are skipped.
