---
description: 'defineRule API 레퍼런스 — 프로바이더, 스키마, 체크 함수로 타입 안전한 규칙 작성.'
---

# defineRule

타입이 지정된 규칙(Rule) 정의를 생성합니다.

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
    // ctx.rootDir     — 프로젝트 루트 디렉토리
    // ctx.options     — 사용자 설정의 타입이 지정된 옵션
    // ctx.providers   — 데이터 소스 프로바이더(Provider)
    // ctx.report()    — 위반 사항 보고
  },
});
```

## 타입 파라미터(Type Parameters)

```ts
defineRule<TOptions = Record<string, unknown>>(definition): RuleDefinition<TOptions>
```

`TOptions`는 `check()` 내부의 `ctx.options` 객체에 타입을 부여합니다.

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
