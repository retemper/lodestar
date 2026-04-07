# test-utils

Testing utilities for Lodestar rules. Provides mock providers and a test context that collects violations, so you can unit test rules without touching the file system or real dependency graphs.

```sh
pnpm add -D @lodestar/test-utils
```

## createMockProviders

Creates a full `RuleProviders` object with stub implementations. Every method returns a sensible default (empty arrays, empty objects, `true` for `exists`, `false` for `hasCircular`). Pass overrides to replace specific methods.

```ts
function createMockProviders(overrides?: MockProviderOverrides): RuleProviders;
```

### MockProviderOverrides

All fields are optional. Each overrides one provider method:

| Field             | Default Return         | Provider | Description                         |
| ----------------- | ---------------------- | -------- | ----------------------------------- |
| `glob`            | `[]`                   | `fs`     | Find files matching a pattern       |
| `readFile`        | `''`                   | `fs`     | Read file contents                  |
| `exists`          | `true`                 | `fs`     | Check if a path exists              |
| `readJson`        | `{}`                   | `fs`     | Read and parse a JSON file          |
| `getDependencies` | `[]`                   | `graph`  | Get files that a file imports       |
| `getDependents`   | `[]`                   | `graph`  | Get files that import a file        |
| `hasCircular`     | `false`                | `graph`  | Check for circular dependencies     |
| `getModuleGraph`  | `{ nodes: new Map() }` | `graph`  | Get the full module graph           |
| `getSourceFile`   | `null`                 | `ast`    | Get AST source file                 |
| `getImports`      | `[]`                   | `ast`    | Get import declarations from a file |
| `getExports`      | `[]`                   | `ast`    | Get export declarations from a file |
| `getPackageJson`  | `{}`                   | `config` | Read package.json                   |
| `getTsConfig`     | `{}`                   | `config` | Read tsconfig.json                  |
| `getCustomConfig` | `{}`                   | `config` | Read a custom config file           |

### Example

```ts
import { vi } from 'vitest';
import { createMockProviders } from '@lodestar/test-utils';

const providers = createMockProviders({
  glob: vi.fn().mockImplementation((pattern: string) => {
    if (pattern === 'src/**/*.ts') {
      return Promise.resolve(['src/index.ts', 'src/utils.ts']);
    }
    return Promise.resolve([]);
  }),
  exists: vi.fn().mockResolvedValue(false),
});
```

## createTestContext

Creates a `RuleContext` that collects violations into a returned array. Returns both the context and the violations array so you can inspect reported violations after calling `rule.check(ctx)`.

```ts
function createTestContext<TOptions = Record<string, unknown>>(
  options: TOptions,
  providers: RuleProviders,
  ruleId?: string,
): TestContextResult<TOptions>;
```

### Parameters

| Parameter   | Type            | Default  | Description                             |
| ----------- | --------------- | -------- | --------------------------------------- |
| `options`   | `TOptions`      | --       | Rule options to pass to the rule        |
| `providers` | `RuleProviders` | --       | Providers (use `createMockProviders`)   |
| `ruleId`    | `string`        | `'test'` | Rule ID assigned to reported violations |

### TestContextResult

| Field        | Type                    | Description                                     |
| ------------ | ----------------------- | ----------------------------------------------- |
| `ctx`        | `RuleContext<TOptions>` | The context to pass to `rule.check()`           |
| `violations` | `Violation[]`           | Mutable array that collects reported violations |

The returned `ctx` has:

- `rootDir` set to `'/test'`
- `report()` that pushes to `violations` with severity `'error'`
- `meta()` as a no-op

### Example

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { directoryExists } from '@lodestar/plugin-structure';

describe('structure/directory-exists', () => {
  it('reports a violation when a required path is missing', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue([]),
    });
    const { ctx, violations } = createTestContext(
      { required: ['src/missing'] },
      providers,
      'structure/directory-exists',
    );

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('src/missing');
    expect(violations[0].message).toContain('does not exist');
  });

  it('passes when the required path exists', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src']),
    });
    const { ctx, violations } = createTestContext(
      { required: ['src'] },
      providers,
      'structure/directory-exists',
    );

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(0);
  });
});
```

## Full Testing Pattern

A complete test for a custom rule:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { myCustomRule } from './my-custom-rule';

describe('my-plugin/my-custom-rule', () => {
  it('reports no violations when all conditions are met', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/index.ts']),
      exists: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext(
      {
        /* rule options */
      },
      providers,
      'my-plugin/my-custom-rule',
    );

    await myCustomRule.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('captures violation metadata', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/bad-file.ts']),
    });
    const { ctx, violations } = createTestContext(
      {
        /* rule options */
      },
      providers,
    );

    await myCustomRule.check(ctx);

    expect(violations[0]).toStrictEqual(
      expect.objectContaining({
        ruleId: expect.any(String),
        message: expect.any(String),
        severity: 'error',
      }),
    );
  });
});
```
