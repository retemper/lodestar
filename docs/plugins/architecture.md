# plugin-architecture

The core plugin. Enforces intra-package architecture rules — layer dependencies, module boundaries, and circular import detection.

```sh
pnpm add -D @retemper/lodestar-plugin-architecture
```

```ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: { ... },
});
```

## Rules

### `architecture/layers`

Enforce dependency direction between architectural layers. Each layer declares what it **can** import. Everything else is forbidden.

```ts
'architecture/layers': {
  severity: 'error',
  options: {
    layers: [
      { name: 'domain', path: 'src/domain/**' },
      { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
    ],
    allowTypeOnly: false, // default: false
  },
}
```

**Options:**

| Option          | Type                | Description                                      |
| --------------- | ------------------- | ------------------------------------------------ |
| `layers`        | `LayerDefinition[]` | Layer definitions with dependency constraints    |
| `allowTypeOnly` | `boolean`           | When true, type-only imports bypass layer checks |

**Providers:** `ast`, `fs`

**Behavior:**

- Same-layer imports are always allowed
- New layers are forbidden by default (must explicitly add to `canImport`)
- Works for any architecture: Clean Architecture, Hexagonal, Feature Slices, Server/Client

---

### `architecture/modules`

Enforce module encapsulation. Directories declared as modules must be imported through their barrel (`index.ts`).

```ts
'architecture/modules': {
  severity: 'error',
  options: {
    modules: ['src/billing', 'src/auth'],
    allow: ['src/billing/testing'], // optional allowlist
  },
}
```

**Options:**

| Option    | Type       | Description                      |
| --------- | ---------- | -------------------------------- |
| `modules` | `string[]` | Module root directories          |
| `allow`   | `string[]` | Deep import paths to permit      |
| `include` | `string[]` | Glob patterns for files to check |
| `exclude` | `string[]` | Glob patterns for files to skip  |

**Providers:** `ast`, `fs`

---

### `architecture/no-circular`

Detect circular dependency chains between files.

```ts
'architecture/no-circular': {
  severity: 'error',
  options: {
    entries: ['src/**/*.ts'],  // optional: only scan these
    ignore: ['**/*.spec.ts'],  // optional: skip these
    maxDepth: 5,               // optional: ignore long cycles
  },
}
```

**Options:**

| Option     | Type       | Description                            |
| ---------- | ---------- | -------------------------------------- |
| `entries`  | `string[]` | Glob patterns for entry points to scan |
| `ignore`   | `string[]` | Glob patterns for files to exclude     |
| `maxDepth` | `number`   | Maximum cycle chain length to report   |

**Providers:** `graph`

---

### `architecture/no-circular-packages`

Detect circular dependencies between workspace packages by analyzing `package.json`.

```ts
'architecture/no-circular-packages': {
  severity: 'error',
  options: {
    scope: '@myorg', // optional: auto-detected
  },
}
```

**Options:**

| Option  | Type     | Description                               |
| ------- | -------- | ----------------------------------------- |
| `scope` | `string` | Package scope prefix to treat as internal |

**Providers:** `fs`, `config`
