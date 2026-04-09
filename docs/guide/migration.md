---
description: 'Adopt Lodestar incrementally in an existing project using baselines to suppress legacy violations.'
---

# Adopting Lodestar in an Existing Project

A step-by-step guide to introducing Lodestar into a project that already has code, dependencies, and existing tooling.

::: tip
See complete working examples in the [`examples/`](https://github.com/retemper/lodestar/tree/main/examples) directory — including [Clean Architecture](https://github.com/retemper/lodestar/tree/main/examples/clean-architecture) and [Hexagonal Architecture](https://github.com/retemper/lodestar/tree/main/examples/hexagonal) setups.
:::

## Step 1: Install

```sh
npm install -D lodestar @retemper/lodestar-plugin-architecture
```

## Step 2: Start with Warnings

Don't start with `'error'` severity. Use `'warn'` to see what violations exist without breaking your build:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'warn', // start soft
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
        ],
      },
    },
    'architecture/no-circular': 'warn',
  },
});
```

## Step 3: Run and Assess

```sh
npx lodestar check
```

Review the output. Existing codebases typically have violations. This is expected — the goal is to understand the current state, not to fix everything at once.

Use the graph command to visualize your architecture:

```sh
npx lodestar graph --layers
```

## Step 4: Fix Violations Incrementally

Address violations one area at a time. Common strategies:

- **Layer violations:** Move imports behind proper abstractions or relocate files to the correct layer.
- **Circular dependencies:** Break cycles by introducing interfaces or extracting shared code.
- **Module encapsulation:** Re-export through barrel files (`index.ts`) and remove deep imports.

## Step 5: Adopt Adapters Gradually

If you already use ESLint, Prettier, or other tools, adopt their adapters one at a time. This centralizes your config without changing tool behavior.

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig({
  adapters: [
    eslintAdapter({ presets: ['strict'] }),
    prettierAdapter({ singleQuote: true }),
  ],
  // ...rules
});
```

Then generate the bridge files:

```sh
npx lodestar check --fix
```

This creates managed config files (`eslint.config.js`, `.prettierrc`, etc.) that delegate to your lodestar config.

::: tip
Back up or commit your existing tool configs before running `--fix`, so you can compare and verify that behavior is preserved.
:::

## Step 6: Promote to Error

Once violations are resolved (or at least triaged), promote rules from `'warn'` to `'error'`:

```ts
rules: {
  'architecture/layers': {
    severity: 'error', // now enforced
    options: { /* ... */ },
  },
  'architecture/no-circular': 'error',
}
```

## Step 7: Add to CI

```yaml
- run: npx lodestar check
```

See [CI/CD Integration](/guide/ci) for detailed examples.

## Handling Legacy Violations

If you can't fix all violations before enforcing, use flat config to scope rules to new code:

```ts
export default defineConfig([
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error', // enforced everywhere
    },
  },
  {
    files: ['src/new-feature/**'],
    rules: {
      'architecture/layers': {
        severity: 'error', // enforced only in new code
        options: { /* ... */ },
      },
    },
  },
]);
```

This lets you enforce rules on new code while giving legacy code time to comply.

## Migrating Tool Configs

When adopting adapters, your existing tool configs become managed by lodestar. Here's how the transition works:

| Before                         | After                                               |
| ------------------------------ | --------------------------------------------------- |
| Hand-written `eslint.config.js`| Bridge file delegating to `lodestar.config.ts`      |
| Hand-written `.prettierrc`     | Generated `.prettierrc` from adapter options         |
| Hand-written `biome.json`      | Generated `biome.json` from adapter options          |

**To migrate:**

1. Note your current tool settings.
2. Translate them into the corresponding adapter options in `lodestar.config.ts`.
3. Run `lodestar check --fix` to generate the managed config files.
4. Verify that tool behavior is unchanged (run ESLint, Prettier, etc. directly).
5. Remove any tool-specific config files from `.gitignore` — they should be committed.
