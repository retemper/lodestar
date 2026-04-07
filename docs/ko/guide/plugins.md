# 플러그인(Plugins)

플러그인(Plugin)은 규칙(Rule)의 이름 있는 컬렉션입니다. Lodestar는 하나의 공식 플러그인을 제공하며, 커스텀 서드파티 플러그인도 지원합니다.

## 공식 플러그인

| 플러그인                                                    | 주요 기능                                  |
| ----------------------------------------------------------- | ------------------------------------------ |
| [`@retemper/lodestar-plugin-architecture`](/ko/plugins/architecture) | 레이어 경계, 모듈 캡슐화, 순환 의존성 탐지 |

## 플러그인 사용

플러그인은 **named export**로 임포트하여 `plugins` 배열에 직접 전달합니다:

```ts
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
        ],
      },
    },
    'architecture/no-circular': 'error',
  },
});
```

등록된 플러그인의 규칙만 설정할 수 있습니다. 규칙 이름에는 플러그인의 네임스페이스가 접두사로 붙습니다 (`architecture/`).

## 서드파티 플러그인

`definePlugin()` 결과를 내보내는 모든 npm 패키지를 사용할 수 있습니다:

```ts
import { pluginMyTeam } from 'lodestar-plugin-my-team';

export default defineConfig({
  plugins: [pluginMyTeam],
});
```

직접 만드는 방법은 [커스텀 플러그인](/ko/guide/custom-plugins)을 참고하세요.
