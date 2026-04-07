# What is Lodestar?

Lodestar enforces **intra-package architecture rules** that ESLint can't — layer dependencies, module boundaries, circular imports. Define your architecture in `lodestar.config.ts`, enforce it in CI.

## The Problem

As projects grow, architectural decisions erode:

- The domain layer starts importing from infrastructure
- Modules reach into each other's internals
- Circular dependencies appear between files
- Dependencies flow in the wrong direction

Code review catches some of this, but not all, and not consistently. By the time a violation is caught, it's often deeply entrenched.

## The Solution

Lodestar makes architectural rules **explicit**, **declarative**, and **enforceable**:

```ts
// lodestar.config.ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@retemper/plugin-architecture';

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

Run `npx lodestar check` in CI, and violations fail the build — just like a linter, but for architecture.

## Key Principles

### Pluggable

Rules are organized into plugins. Use the official plugin or write your own. Each rule declares what data it needs (file system, AST, dependency graph) and the engine provides it.

### Configurable

Rules accept options, not hardcoded behavior. `layers` takes an array of layer definitions. `modules` takes an array of module paths. You choose what to enforce.

### Non-invasive

Lodestar is a dev dependency with zero runtime impact. It reads your code but never modifies it. Drop it, and nothing breaks.
