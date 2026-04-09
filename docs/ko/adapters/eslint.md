---
description: 'adapter-eslint — lodestar.config.ts에서 ESLint flat config를 생성하여 규칙을 중앙 관리.'
---

# adapter-eslint

ESLint를 Node API로 실행하고, IDE 연동을 위한 `eslint.config.js` 브릿지(Bridge) 파일을 생성합니다.

**패키지:** `@retemper/lodestar-adapter-eslint`

**관리 파일:** `eslint.config.js`

## 설정 옵션

| 옵션        | 타입                                                    | 설명                                                                               |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `presets`   | `string[]`                                              | 기본 설정 -- `'recommended'`, `'strict'`, `'stylistic'` (typescript-eslint에 매핑) |
| `plugins`   | `Record<string, unknown>`                               | 포함할 ESLint 플러그인 패키지                                                      |
| `rules`     | `Record<string, unknown>`                               | 표준 심각도/옵션 형식의 ESLint 규칙                                                |
| `ignores`   | `string[]`                                              | 글로벌 무시 패턴                                                                   |
| `overrides` | `{ files: string[]; rules: Record<string, unknown> }[]` | 파일별 규칙 오버라이드                                                             |

## 예시

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

eslintAdapter({
  presets: ['strict'],
  plugins: { 'import-x': importX, unicorn },
  ignores: ['dist/**', 'node_modules/**'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    'import-x/no-default-export': 'error',
    'unicorn/prefer-node-protocol': 'error',
  },
  overrides: [
    {
      files: ['**/*.spec.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
});
```

## 생성되는 브릿지 파일

`verifySetup`은 프로젝트 루트에 다음 내용의 `eslint.config.js`가 존재하는지 확인합니다:

```js
import { fromLodestar } from '@retemper/lodestar-adapter-eslint';

export default await fromLodestar();
```

이 브릿지 파일은 런타임에 lodestar 설정으로 위임하여, IDE와 CI 모두 동일한 규칙을 읽습니다. 파일이 없으면 설정 누락(Missing) 위반이 보고됩니다. 파일이 존재하지만 내용이 기대와 다르면 드리프트(Drift) 위반이 보고됩니다.

`lodestar check --fix`를 실행하면 브릿지 파일을 자동 생성하거나 업데이트하여 설정 위반을 해결합니다.

## verifySetup 동작 방식

1. `rootDir`에 `eslint.config.js`가 존재하는지 확인합니다.
2. 파일 내용을 읽고 기대하는 브릿지 파일 내용과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. 브릿지 파일이 정확하면 위반을 반환하지 않습니다.

드리프트는 브릿지 파일이 수동으로 편집되었거나 다른 도구에 의해 생성되었음을 의미합니다. 수정 방법은 lodestar가 파일을 재생성하도록 하는 것입니다.

## check 동작 방식

어댑터는 ESLint의 Node API를 사용하여 프로그래밍 방식으로 파일을 린트합니다:

1. 어댑터 옵션(presets, plugins, rules, overrides)으로 flat config를 빌드합니다.
2. `overrideConfigFile: true`로 `ESLint` 인스턴스를 생성하여 검사 중에는 브릿지 파일을 우회합니다.
3. 설정된 파일 패턴에 대해 `eslint.lintFiles()`를 실행합니다.
4. 각 ESLint 메시지를 원본 ESLint 규칙 ID에 `eslint/` 접두사를 붙여 lodestar `Violation`으로 매핑합니다.

심각도 매핑: ESLint 심각도 `2`는 `'error'`, 심각도 `1`은 `'warn'`이 됩니다.

## 자동 수정

어댑터는 `fix()`를 구현하며, `fix: true`가 활성화된 상태로 ESLint를 실행합니다. `lodestar check --fix`를 실행하면 적용 가능한 ESLint 위반을 자동 수정한 후 `ESLint.outputFixes()`를 통해 변경 사항을 디스크에 기록합니다.
