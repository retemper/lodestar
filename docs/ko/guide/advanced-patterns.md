---
description: 'Lodestar 고급 패턴 — 조건부 규칙, 공유 설정, 동적 옵션, 다중 레이어 구성.'
---

# 고급 패턴

더 복잡한 아키텍처, 멀티 패키지 설정, 또는 정교한 규칙 적용이 필요한 팀을 위한 패턴입니다.

## 패키지 간 공유 설정

모노레포에서 설정을 복제하지 않고 패키지 간에 일관된 규칙을 유지하려면 공유 설정 팩토리를 추출하세요:

```ts
// tools/lodestar-config/shared.ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import type { WrittenConfig } from '@retemper/lodestar';

export function createSharedConfig(overrides?: Partial<WrittenConfig>): WrittenConfig {
  return {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
      ...overrides?.rules,
    },
    ...overrides,
  };
}
```

각 패키지에서 사용하세요:

```ts
// packages/billing/lodestar.config.ts
import { defineConfig } from '@retemper/lodestar';
import { createSharedConfig } from '../../tools/lodestar-config/shared';

export default defineConfig(
  createSharedConfig({
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**' },
            { name: 'service', path: 'src/service/**', canImport: ['domain'] },
          ],
        },
      },
    },
  }),
);
```

## 피처 슬라이스

피처 슬라이스 아키텍처에서는 각 피처를 내부 레이어가 있는 모듈로 정의하세요:

```ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/modules': {
      severity: 'error',
      options: {
        modules: ['src/features/auth', 'src/features/billing', 'src/features/dashboard'],
      },
    },
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'shared', path: 'src/shared/**' },
          {
            name: 'features',
            path: 'src/features/**',
            canImport: ['shared'],
          },
          {
            name: 'app',
            path: 'src/app/**',
            canImport: ['features', 'shared'],
          },
        ],
      },
    },
  },
});
```

이렇게 하면:

- 피처끼리 직접 import할 수 없음 (모듈 캡슐화)
- 피처는 `shared`에서만 import 가능
- `app` 레이어만 피처를 조합할 수 있음

## 타입 전용 Import 예외

일부 아키텍처는 경계를 넘는 타입 import을 허용합니다(예: 직렬화를 위해 infra에서 사용하는 도메인 타입). 규칙별로 활성화하세요:

```ts
'architecture/layers': {
  severity: 'error',
  options: {
    allowTypeOnly: true,
    layers: [
      { name: 'domain', path: 'src/domain/**' },
      { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
    ],
  },
}
```

`allowTypeOnly: true`이면 런타임 import이 금지되더라도 `import type { User } from '../domain/user'`는 허용됩니다.

## Flat Config를 활용한 범위별 규칙

flat config(배열 형식)를 사용하여 코드베이스의 다른 부분에 다른 규칙을 적용하세요:

```ts
export default defineConfig([
  // 전역 규칙 -- 모든 곳에 적용
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },
  // 백엔드 전용 규칙
  {
    files: ['src/server/**'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'routes', path: 'src/server/routes/**' },
            { name: 'services', path: 'src/server/services/**', canImport: ['routes'] },
            { name: 'db', path: 'src/server/db/**', canImport: ['services'] },
          ],
        },
      },
    },
  },
  // 모듈 규칙에서 테스트 파일 제외
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    rules: {
      'architecture/modules': {
        severity: 'error',
        options: { modules: ['src/auth', 'src/billing'] },
      },
    },
  },
]);
```

## 순환 의존성 감지 제어

대규모 코드베이스에서는 순환 의존성 검사를 세밀하게 조정하세요:

```ts
'architecture/no-circular': {
  severity: 'error',
  options: {
    // 소스 파일만 스캔, 테스트나 생성 코드 제외
    entries: ['src/**/*.ts'],
    ignore: ['**/*.spec.ts', '**/*.test.ts', 'src/generated/**'],
    // 짧은 순환만 보고 (긴 체인은 대체로 오탐)
    maxDepth: 5,
  },
}
```

## 워크스페이스 수준 패키지 검사

`architecture/no-circular-packages`를 사용하여 워크스페이스 패키지 간 순환 의존성을 방지하세요:

```ts
// 루트 lodestar.config.ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/no-circular-packages': {
      severity: 'error',
      options: {
        scope: '@myorg', // @myorg/* 패키지를 내부 패키지로 취급
      },
    },
  },
});
```

각 패키지의 `package.json`에서 `dependencies`와 `devDependencies`를 읽어 패키지 수준의 순환 체인을 보고합니다.

## 아키텍처 규칙과 어댑터 결합

아키텍처 강제와 도구 설정을 결합한 전체 설정:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';
import { huskyAdapter } from '@retemper/lodestar-adapter-husky';
import { lintStagedAdapter } from '@retemper/lodestar-adapter-lint-staged';
import { commitlintAdapter } from '@retemper/lodestar-adapter-commitlint';

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
    'architecture/modules': {
      severity: 'error',
      options: { modules: ['src/domain', 'src/application'] },
    },
  },
  adapters: [
    eslintAdapter({ presets: ['strict'] }),
    prettierAdapter({ singleQuote: true, printWidth: 100 }),
    huskyAdapter({
      hooks: { 'pre-commit': ['npx lint-staged'], 'commit-msg': ['npx commitlint --edit "$1"'] },
    }),
    lintStagedAdapter({
      commands: { '*.{ts,tsx}': 'eslint --fix', '*.{ts,tsx,json,md}': 'prettier --write' },
    }),
    commitlintAdapter({ extends: ['@commitlint/config-conventional'] }),
  ],
});
```

이 단일 설정이 다음을 통제합니다:

- 아키텍처 규칙 (레이어, 순환 의존성, 모듈 캡슐화)
- 린팅(ESLint)과 포맷팅(Prettier)
- Git 훅(Husky)과 스테이지된 파일 검사(lint-staged)
- 커밋 메시지 형식(commitlint)
