# 설정(Configuration)

Lodestar는 프로젝트 루트의 `lodestar.config.ts` 파일로 설정합니다.

## 설정 파일

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

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

## 파일 형식

Lodestar는 다음 순서로 설정 파일을 탐색합니다:

1. `lodestar.config.ts`
2. `lodestar.config.mjs`
3. `lodestar.config.js`

## 설정 블록 속성

### `plugins`

플러그인(Plugin) 인스턴스 배열입니다. 플러그인은 named export로 가져옵니다:

```ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
});
```

### `rules`

규칙(Rule) ID와 설정의 매핑입니다:

```ts
rules: {
  'rule-name': 'error',           // 축약형 — 심각도만
  'rule-name': {                   // 전체 형식 — 심각도 + 옵션
    severity: 'warn',
    options: { /* 규칙별 옵션 */ },
  },
}
```

### `adapters`

도구 어댑터(Adapter) 배열입니다. 자세한 내용은 [어댑터 가이드](/ko/guide/adapters)를 참고하세요.

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] }), prettierAdapter({ singleQuote: true })],
});
```

### `files`와 `ignores`

설정 블록을 특정 파일로 범위 지정하는 글로브(Glob) 패턴입니다. 플랫 설정(배열 형식)에서만 의미가 있습니다:

```ts
export default defineConfig([
  {
    // 전역 블록 — 모든 파일에 적용
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },
  {
    // 범위 지정 블록 — src/에만 적용
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          /* ... */
        },
      },
    },
  },
]);
```

## 플랫 설정(Flat Config) — 배열 형식

Lodestar는 플랫 설정 모델을 사용합니다. 단일 블록 또는 블록 배열을 전달할 수 있습니다. 배열 형식은 각 블록의 `files`와 `ignores`를 통해 파일 범위 지정이 가능합니다:

```ts
export default defineConfig([
  globalBlock, // `files` 없음 — 모든 곳에 적용
  scopedBlock, // `files` 있음 — 매칭되는 경로에만 적용
]);
```

블록은 순서대로 병합됩니다. 동일 규칙에 대해 이후 블록이 이전 블록을 덮어씁니다.

## 워크스페이스 모드

모노레포에서는 각 패키지가 자체 `lodestar.config.ts`를 가질 수 있습니다. `lodestar check --workspace`로 모든 패키지를 검사합니다. 자세한 내용은 [워크스페이스 모드](/ko/guide/workspace)를 참고하세요.
