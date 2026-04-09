---
description: 'Lodestar 규칙의 작동 방식 — 심각도, 옵션, 프로바이더, 설정 방법을 알아봅니다.'
---

# 규칙(Rules)

규칙(Rule)은 가장 작은 검사 단위입니다. 각 규칙은 필요한 데이터 소스를 선언하고 프로젝트에 대해 검사를 수행합니다.

## 규칙의 구조

```ts
import { defineRule } from '@retemper/lodestar';

const myRule = defineRule({
  name: 'my-plugin/my-rule',
  description: 'What this rule checks',
  needs: ['fs'], // data sources: 'fs', 'graph', 'ast', 'config'
  schema: {
    /* JSON Schema */
  }, // validates options
  async check(ctx) {
    // ctx.providers.fs — file system access
    // ctx.options     — user-provided options
    // ctx.report()    — report a violation
  },
});
```

## 프로바이더(Providers)

규칙은 `needs` 배열을 통해 필요한 프로바이더를 선언합니다:

| 프로바이더 | 접근 방법              | 사용 사례                                          |
| ---------- | ---------------------- | -------------------------------------------------- |
| `fs`       | `ctx.providers.fs`     | 파일 글로빙, 내용 읽기, 존재 여부 확인             |
| `graph`    | `ctx.providers.graph`  | 의존성 조회, 의존자 조회, 순환 참조 탐지           |
| `ast`      | `ctx.providers.ast`    | 임포트/익스포트 파싱, TypeScript AST 접근          |
| `config`   | `ctx.providers.config` | package.json, tsconfig.json, 커스텀 설정 파일 읽기 |

## 심각도(Severity)

규칙은 세 가지 심각도 수준으로 설정할 수 있습니다:

| 심각도    | 동작                                           |
| --------- | ---------------------------------------------- |
| `'error'` | 오류로 보고되며, 0이 아닌 종료 코드를 발생시킴 |
| `'warn'`  | 경고로 보고되며, 빌드를 실패시키지 않음        |
| `'off'`   | 규칙을 완전히 비활성화                         |

## 규칙 설정

```ts
rules: {
  // 축약 형식: 심각도만
  'dependency-graph/no-circular': 'error',

  // 전체 형식: 심각도 + 옵션
  'naming-convention/file-naming': {
    severity: 'warn',
    options: {
      scopes: [
        {
          include: 'src/**/*.ts',
          convention: 'kebab-case',
        },
      ],
    },
  },

  // 규칙 비활성화
  'import-boundary/no-deep-import': 'off',
}
```

## 위반 보고

`check()` 내부에서 `ctx.report()`를 호출하여 위반을 보고합니다:

```ts
ctx.report({
  message: 'Human-readable description of the problem',
  location: {
    file: 'src/bad-file.ts',
    line: 42, // optional
    column: 10, // optional
  },
});
```
