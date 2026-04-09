---
description: 'API reference for definePlugin — bundle rules into plugins with metadata and named exports.'
---

# definePlugin

Create a plugin that bundles multiple rules.

```ts
import { definePlugin } from '@retemper/lodestar';

export default definePlugin((options) => ({
  name: 'my-plugin',
  rules: [ruleA, ruleB, ruleC],
}));
```

## Signature

```ts
definePlugin(factory: (options?: Record<string, unknown>) => PluginDefinition): Plugin
```

## `PluginDefinition`

```ts
interface PluginDefinition {
  readonly name: string;
  readonly rules: readonly RuleDefinition[];
}
```

## Naming

- Plugin name: used as the namespace prefix for rules (e.g., `my-plugin/rule-name`)
- npm package: `lodestar-plugin-{name}` or `@scope/lodestar-plugin-{name}`
