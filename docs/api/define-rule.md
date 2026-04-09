---
description: 'API reference for defineRule — create typed rules with providers, schemas, and check functions.'
---

# defineRule

Create a typed rule definition.

```ts
import { defineRule } from '@retemper/lodestar';

const myRule = defineRule<MyOptions>({
  name: 'namespace/rule-name',
  description: 'What this rule checks',
  needs: ['fs', 'graph'],
  schema: {
    /* JSON Schema for options */
  },
  async check(ctx) {
    // ctx.rootDir     — project root directory
    // ctx.options     — typed options from user config
    // ctx.providers   — data source providers
    // ctx.report()    — report a violation
  },
});
```

## Type Parameters

```ts
defineRule<TOptions = Record<string, unknown>>(definition): RuleDefinition<TOptions>
```

`TOptions` types the `ctx.options` object inside `check()`.

## `RuleDefinition`

```ts
interface RuleDefinition<TOptions> {
  readonly name: string;
  readonly description: string;
  readonly needs: readonly ('fs' | 'graph' | 'ast' | 'config')[];
  readonly schema?: JSONSchema7;
  check(ctx: RuleContext<TOptions>): Promise<void>;
}
```

## `RuleContext`

```ts
interface RuleContext<TOptions> {
  readonly rootDir: string;
  readonly options: Readonly<TOptions>;
  readonly providers: RuleProviders;
  report(violation: { message: string; location?: SourceLocation }): void;
  meta(summary: string): void;
}
```

## `SourceLocation`

```ts
interface SourceLocation {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
}
```
