# definePlugin

여러 규칙(Rule)을 묶는 플러그인(Plugin)을 생성합니다.

```ts
import { definePlugin } from 'lodestar';

export default definePlugin((options) => ({
  name: 'my-plugin',
  rules: [ruleA, ruleB, ruleC],
}));
```

## 시그니처(Signature)

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

## 네이밍

- 플러그인 이름: 규칙의 네임스페이스 접두사로 사용됩니다 (예: `my-plugin/rule-name`)
- npm 패키지: `lodestar-plugin-{name}` 또는 `@scope/lodestar-plugin-{name}`
