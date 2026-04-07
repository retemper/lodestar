# Lodestar란?

Lodestar는 ESLint가 할 수 없는 **패키지 내부 아키텍처 규칙**을 강제합니다 -- 레이어 의존성, 모듈 경계, 순환 참조. `lodestar.config.ts`에 아키텍처를 정의하고 CI에서 강제하세요.

## 문제

프로젝트가 커지면 아키텍처 결정이 무너지기 시작합니다:

- 도메인 레이어가 인프라를 임포트하기 시작
- 모듈이 서로의 내부 구현에 접근
- 파일 간 순환 의존성 발생
- 의존성 흐름이 잘못된 방향으로 형성

코드 리뷰가 일부를 잡아내지만, 전부는 아니며 일관적이지도 않습니다. 위반이 발견될 때쯤이면 이미 깊이 뿌리내린 경우가 많습니다.

## 해결책

Lodestar는 아키텍처 규칙을 **명시적**이고, **선언적**이며, **강제 가능**하게 만듭니다:

```ts
// lodestar.config.ts
import { defineConfig } from 'lodestar';
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

CI에서 `npx lodestar check`를 실행하면 위반 사항이 빌드를 실패시킵니다 -- 린터처럼, 하지만 아키텍처를 위한 것입니다.

## 핵심 원칙

### 플러그 가능(Pluggable)

규칙(Rule)은 플러그인(Plugin)으로 구성됩니다. 공식 플러그인을 사용하거나 직접 작성할 수 있습니다. 각 규칙은 필요한 데이터(파일 시스템, AST, 의존성 그래프)를 선언하고 엔진이 이를 제공합니다.

### 설정 가능(Configurable)

규칙은 하드코딩된 동작이 아닌 옵션을 받습니다. `layers`는 레이어 정의 배열을 받고, `modules`는 모듈 경로 배열을 받습니다. 무엇을 강제할지 직접 선택합니다.

### 비침습적(Non-invasive)

Lodestar는 런타임에 영향을 주지 않는 dev dependency입니다. 코드를 읽기만 하고 수정하지 않습니다. 제거해도 아무것도 깨지지 않습니다.
