# 시작하기

## 설치

```sh
npm install -D lodestar @retemper/plugin-architecture
```

## 설정 초기화

```sh
npx lodestar init
```

이 명령은 `lodestar.config.ts`를 생성합니다:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@retemper/plugin-architecture';

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
  },
});
```

## 규칙 추가

`rules` 객체에서 규칙을 설정합니다. 각 규칙은 플러그인 네임스페이스로 접두사가 붙습니다:

```ts
export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    // 전체 형식 -- 심각도 + 옵션
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
        ],
      },
    },
    // 축약 형식 -- 심각도만
    'architecture/no-circular': 'error',
    // 모듈 캡슐화
    'architecture/modules': {
      severity: 'error',
      options: { modules: ['src/domain', 'src/billing'] },
    },
  },
});
```

## 검사 실행

```sh
npx lodestar check
```

출력:

```
  lodestar check

  ✗ architecture/layers
    Layer "domain" cannot import from "infra" — not listed in canImport
    at src/domain/entity.ts:5

  ✗ architecture/no-circular
    Circular dependency detected starting from "src/a.ts"
    at src/a.ts

  2 errors, 0 warnings
```

## 시각화

```sh
npx lodestar graph --layers
```

선언된 아키텍처를 실제 의존성 개수와 함께 Mermaid 다이어그램으로 보여줍니다. 위반 사항은 점선으로 표시됩니다.

## CI에 추가

```yaml
# .github/workflows/ci.yml
- run: npx lodestar check
```

심각도가 `error`인 위반이 있으면 0이 아닌 종료 코드를 반환합니다.

## 다음 단계

- [규칙(Rules)](/ko/guide/rules) -- 규칙의 작동 방식
- [플러그인(Plugins)](/ko/guide/plugins) -- 공식 플러그인 살펴보기
- [설정(Configuration)](/ko/guide/configuration) -- 전체 설정 레퍼런스
- [워크스페이스 모드(Workspace Mode)](/ko/guide/workspace) -- 모노레포 지원
