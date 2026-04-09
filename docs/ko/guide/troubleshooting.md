---
description: 'Lodestar 문제 해결 — 설정 오류, 규칙 충돌, 성능 팁, 디버깅 방법.'
---

# 문제 해결

자주 발생하는 문제와 해결 방법입니다.

## 설정 파일을 찾을 수 없음

```
No lodestar.config.ts found in /your/project
```

**원인:** CLI가 프로젝트 루트에서 설정 파일을 찾지 못했습니다.

**해결 방법:**

1. 프로젝트 루트에 다음 파일 중 하나가 있는지 확인하세요:
   - `lodestar.config.ts`
   - `lodestar.config.mjs`
   - `lodestar.config.js`
2. `npx lodestar init`을 실행하여 설정 파일을 생성하세요.
3. 하위 디렉토리에 있다면 프로젝트 루트에서 명령을 실행하세요.

## 알 수 없는 규칙

```
Config validation failed:
  - Unknown rule "architecture/laeyrs" in config. Did you mean "architecture/layers"?
```

**원인:** 설정의 규칙 ID가 로드된 플러그인의 어떤 규칙과도 일치하지 않습니다.

**해결 방법:**

1. 규칙 이름에 오타가 없는지 확인하세요.
2. 해당 규칙을 제공하는 플러그인이 `plugins`에 포함되어 있는지 확인하세요:

```ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture], // architecture/* 규칙에 필요
  rules: {
    'architecture/layers': 'error',
  },
});
```

3. 플러그인 패키지가 설치되어 있는지 확인하세요:

```sh
npm install -D @retemper/lodestar-plugin-architecture
```

## 플러그인 해석 실패

```
Failed to resolve plugin: my-plugin
```

**원인:** 플러그인 모듈을 import할 수 없습니다.

**해결 방법:**

1. 플러그인 패키지가 설치되어 있는지 확인하세요: `npm ls <패키지명>`.
2. 설정 파일의 import 경로가 올바른지 확인하세요.
3. 로컬 플러그인을 사용하는 경우 파일 경로가 올바르게 해석되는지 확인하세요.

## 브릿지 / 설정 파일 누락

```
✗ adapter/setup
  Missing eslint.config.js — run `lodestar check --fix` to generate it.
```

**원인:** 어댑터가 관리하는 설정 파일(예: `eslint.config.js`, `.prettierrc`)이 아직 존재하지 않습니다.

**해결 방법:** `lodestar check --fix`를 실행하여 누락된 설정 파일을 자동 생성하세요.

## 설정 드리프트

```
✗ adapter/setup
  .prettierrc content does not match lodestar config (drift detected).
```

**원인:** 관리 대상 설정 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어쓰여서 lodestar 설정과 일치하지 않습니다.

**해결 방법:**

1. `lodestar check --fix`를 실행하여 파일을 재생성하세요.
2. 도구 설정을 커스터마이즈하려면 생성된 파일을 직접 편집하지 말고 `lodestar.config.ts`의 어댑터 옵션을 변경하세요.

## ESLint 연동이 작동하지 않음

```
No lodestar.config.ts with eslintAdapter() found. Add eslintAdapter() to the adapters array.
```

**원인:** `eslint.config.js`의 `fromLodestar()` 함수가 `eslintAdapter`를 포함한 lodestar 설정을 찾지 못했습니다.

**해결 방법:**

1. 설정의 `adapters` 배열에 `eslintAdapter()`를 추가하세요:

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] })],
});
```

2. `eslint.config.js`에 브릿지 코드가 있는지 확인하세요:

```js
import { fromLodestar } from '@retemper/lodestar-adapter-eslint';

export default await fromLodestar();
```

## ESLint 패키지 미설치

```
ESLint is required for the eslint adapter. Install it: npm install -D eslint typescript-eslint
```

**원인:** ESLint 어댑터가 ESLint를 import하려 했지만 패키지가 없습니다.

**해결 방법:**

```sh
npm install -D eslint typescript-eslint
```

## Graph 명령에 아무것도 표시되지 않음

```
No dependencies found.
```

**원인:** 필터링 후 모듈 그래프에 의존성이 없습니다.

**해결 방법:**

1. 프로젝트에 `import` 구문이 있는 TypeScript/JavaScript 소스 파일이 있는지 확인하세요.
2. 설정의 glob 패턴이 모든 파일을 제외하고 있지 않은지 확인하세요.

## --layers 플래그에 layers 규칙 없음

```
No architecture/layers rule found in lodestar.config.ts. Configure layers first.
```

**원인:** `--layers` 플래그는 레이어가 정의된 `architecture/layers` 규칙이 필요합니다.

**해결 방법:** layers 규칙을 설정하세요:

```ts
rules: {
  'architecture/layers': {
    severity: 'error',
    options: {
      layers: [
        { name: 'domain', path: 'src/domain/**' },
        { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      ],
    },
  },
}
```

## Impact 명령: 파일을 찾을 수 없음

```
File not found in module graph: src/missing.ts
```

**원인:** 지정된 파일이 모듈 그래프에 존재하지 않습니다.

**해결 방법:**

1. 파일 경로를 확인하세요 -- 프로젝트 루트 기준 상대 경로여야 합니다.
2. 해당 파일이 프로젝트 진입점에서 도달 가능한 `.ts` 또는 `.js` 파일인지 확인하세요.

## 규칙 실행 중 에러 발생

```
✗ my-plugin/my-rule  Error: something went wrong
```

**원인:** 규칙의 `check()` 함수에서 예상치 못한 에러가 발생했습니다. 에러 발생 전에 보고된 위반 사항은 그대로 유지됩니다.

**해결 방법:**

1. 에러 메시지에서 단서를 확인하세요.
2. 커스텀 규칙이라면 `check()` 함수를 디버그하세요.
3. 내장 규칙이라면 설정 옵션이 예상 스키마와 일치하는지 확인하세요.
4. 올바른 설정에서도 에러가 지속되면 이슈를 등록하세요.

## 경고가 CI를 실패시키지 않음

이것은 의도된 동작입니다. 심각도가 `'error'`인 위반만 0이 아닌 종료 코드를 발생시킵니다. 경고는 정보 제공 목적입니다.

경고로 CI를 실패시키려면 심각도를 `'error'`로 변경하세요:

```ts
rules: {
  'architecture/no-circular': 'error', // 기존 'warn'
}
```

## FAQ

### 여러 플러그인을 함께 사용할 수 있나요?

네. `plugins` 배열에 모든 플러그인을 나열하세요:

```ts
export default defineConfig({
  plugins: [pluginArchitecture, pluginStructure],
  rules: {
    'architecture/layers': 'error',
    'structure/file-naming': 'warn',
  },
});
```

### 플러그인의 규칙을 비활성화하려면?

심각도를 `'off'`로 설정하세요:

```ts
rules: {
  'architecture/no-circular': 'off',
}
```

### 규칙이 크래시해도 위반 사항이 부분적으로 보고되나요?

네. 규칙이 `ctx.report()`를 여러 번 호출한 후 throw하면, 이전에 보고된 모든 위반 사항은 출력에 보존됩니다.

### `--fix`는 검사 실행 전에 셋업 수정을 적용하나요?

네. 셋업 수정(누락된 설정 파일)이 먼저 적용된 후 어댑터 검사가 실행되고, 그 다음 위반 수준 및 어댑터 수준 수정이 적용됩니다.

### 심각도 `'off'`와 설정에서 규칙을 제거하는 것의 차이는?

`'off'`는 규칙을 명시적으로 비활성화합니다 -- 규칙의 `check()`는 여전히 실행되지만 위반 사항이 조용히 무시됩니다. 설정에서 규칙을 제거하면 아예 실행되지 않습니다. 보이는 출력은 동일하지만(위반 보고 없음), `'off'`는 여전히 리소스를 소비합니다. `'off'`는 해당 규칙을 검토한 후 의도적으로 비활성화했음을 문서화하는 데 유용합니다.
