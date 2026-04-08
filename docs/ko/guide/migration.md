# 기존 프로젝트에 Lodestar 도입하기

이미 코드, 의존성, 기존 도구가 있는 프로젝트에 Lodestar를 도입하는 단계별 가이드입니다.

::: tip
[`examples/`](https://github.com/retemper/lodestar/tree/main/examples) 디렉토리에서 완전한 작동 예제를 확인하세요 -- [클린 아키텍처](https://github.com/retemper/lodestar/tree/main/examples/clean-architecture)와 [헥사고날 아키텍처](https://github.com/retemper/lodestar/tree/main/examples/hexagonal) 설정을 포함합니다.
:::

## 1단계: 설치

```sh
npm install -D lodestar @retemper/lodestar-plugin-architecture
```

## 2단계: 경고로 시작하기

처음부터 `'error'` 심각도를 사용하지 마세요. `'warn'`을 사용하여 빌드를 깨지 않으면서 어떤 위반이 있는지 확인하세요:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'warn', // 부드럽게 시작
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
        ],
      },
    },
    'architecture/no-circular': 'warn',
  },
});
```

## 3단계: 실행 및 현황 파악

```sh
npx lodestar check
```

출력을 검토하세요. 기존 코드베이스에는 대체로 위반 사항이 있습니다. 이는 예상된 결과입니다 -- 목표는 현재 상태를 파악하는 것이지 모든 것을 한 번에 고치는 것이 아닙니다.

graph 명령으로 아키텍처를 시각화하세요:

```sh
npx lodestar graph --layers
```

## 4단계: 위반 사항 점진적 수정

한 번에 한 영역씩 위반 사항을 해결하세요. 일반적인 전략:

- **레이어 위반:** import를 적절한 추상화 뒤로 이동하거나 파일을 올바른 레이어로 재배치합니다.
- **순환 의존성:** 인터페이스를 도입하거나 공유 코드를 추출하여 순환을 끊습니다.
- **모듈 캡슐화:** barrel 파일(`index.ts`)을 통해 re-export하고 deep import를 제거합니다.

## 5단계: 어댑터 점진적 도입

이미 ESLint, Prettier 등의 도구를 사용하고 있다면 어댑터를 하나씩 도입하세요. 도구 동작을 변경하지 않으면서 설정을 중앙화합니다.

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig({
  adapters: [
    eslintAdapter({ presets: ['strict'] }),
    prettierAdapter({ singleQuote: true }),
  ],
  // ...rules
});
```

그 다음 브릿지 파일을 생성하세요:

```sh
npx lodestar check --fix
```

이 명령은 lodestar 설정에 위임하는 관리 대상 설정 파일(`eslint.config.js`, `.prettierrc` 등)을 생성합니다.

::: tip
`--fix` 실행 전에 기존 도구 설정을 백업하거나 커밋하여, 동작이 보존되었는지 비교 검증할 수 있도록 하세요.
:::

## 6단계: 에러로 승격

위반 사항이 해결되었거나(최소한 분류되었다면) 규칙을 `'warn'`에서 `'error'`로 승격하세요:

```ts
rules: {
  'architecture/layers': {
    severity: 'error', // 이제 강제
    options: { /* ... */ },
  },
  'architecture/no-circular': 'error',
}
```

## 7단계: CI에 추가

```yaml
- run: npx lodestar check
```

자세한 예시는 [CI/CD 연동](/ko/guide/ci)을 참고하세요.

## 레거시 위반 처리

강제 적용 전에 모든 위반을 수정할 수 없다면, flat config를 사용하여 새 코드에만 규칙을 적용하세요:

```ts
export default defineConfig([
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error', // 전체 적용
    },
  },
  {
    files: ['src/new-feature/**'],
    rules: {
      'architecture/layers': {
        severity: 'error', // 새 코드에만 적용
        options: { /* ... */ },
      },
    },
  },
]);
```

이렇게 하면 새 코드에는 규칙을 강제하면서 레거시 코드에는 준수할 시간을 줄 수 있습니다.

## 도구 설정 마이그레이션

어댑터를 도입하면 기존 도구 설정이 lodestar에 의해 관리됩니다. 전환 방식은 다음과 같습니다:

| 이전                             | 이후                                                |
| -------------------------------- | --------------------------------------------------- |
| 직접 작성한 `eslint.config.js`    | `lodestar.config.ts`에 위임하는 브릿지 파일          |
| 직접 작성한 `.prettierrc`         | 어댑터 옵션에서 생성된 `.prettierrc`                 |
| 직접 작성한 `biome.json`          | 어댑터 옵션에서 생성된 `biome.json`                  |

**마이그레이션 방법:**

1. 현재 도구 설정을 기록합니다.
2. `lodestar.config.ts`의 해당 어댑터 옵션으로 번역합니다.
3. `lodestar check --fix`를 실행하여 관리 대상 설정 파일을 생성합니다.
4. 도구 동작이 변경되지 않았는지 확인합니다(ESLint, Prettier 등을 직접 실행).
5. 도구별 설정 파일을 `.gitignore`에서 제거합니다 -- 커밋 대상이어야 합니다.
