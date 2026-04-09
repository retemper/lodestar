---
description: 'plugin-architecture 레퍼런스 — layers, modules, no-circular, no-circular-packages 규칙.'
---

# plugin-architecture

핵심 플러그인(Plugin)입니다. 패키지 내부의 아키텍처 규칙 -- 레이어 의존성, 모듈 경계, 순환 임포트 감지를 강제합니다.

```sh
pnpm add -D @retemper/lodestar-plugin-architecture
```

```ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: { ... },
});
```

## 규칙(Rules)

### `architecture/layers`

아키텍처 레이어(Layer) 간의 의존성 방향을 강제합니다. 각 레이어는 임포트 **가능한** 대상을 선언합니다. 그 외 모든 것은 금지됩니다.

```ts
'architecture/layers': {
  severity: 'error',
  options: {
    layers: [
      { name: 'domain', path: 'src/domain/**' },
      { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
    ],
    allowTypeOnly: false, // 기본값: false
  },
}
```

**옵션:**

| 옵션            | 타입                | 설명                                                   |
| --------------- | ------------------- | ------------------------------------------------------ |
| `layers`        | `LayerDefinition[]` | 의존성 제약이 포함된 레이어 정의                       |
| `allowTypeOnly` | `boolean`           | true일 때, 타입 전용 임포트는 레이어 검사를 우회합니다 |

**프로바이더(Providers):** `ast`, `fs`

**동작:**

- 같은 레이어 내의 임포트는 항상 허용됩니다
- 새로운 레이어는 기본적으로 금지됩니다 (`canImport`에 명시적으로 추가해야 합니다)
- 모든 아키텍처에서 동작합니다: 클린 아키텍처(Clean Architecture), 헥사고널(Hexagonal), 피처 슬라이스(Feature Slices), 서버/클라이언트

---

### `architecture/modules`

모듈 캡슐화(Encapsulation)를 강제합니다. 모듈로 선언된 디렉토리는 반드시 배럴(barrel) 파일(`index.ts`)을 통해 임포트해야 합니다.

```ts
'architecture/modules': {
  severity: 'error',
  options: {
    modules: ['src/billing', 'src/auth'],
    allow: ['src/billing/testing'], // 선택적 허용 목록
  },
}
```

**옵션:**

| 옵션      | 타입       | 설명                      |
| --------- | ---------- | ------------------------- |
| `modules` | `string[]` | 모듈 루트 디렉토리        |
| `allow`   | `string[]` | 허용할 깊은 임포트 경로   |
| `include` | `string[]` | 검사할 파일의 글로브 패턴 |
| `exclude` | `string[]` | 건너뛸 파일의 글로브 패턴 |

**프로바이더(Providers):** `ast`, `fs`

---

### `architecture/no-circular`

파일 간 순환 의존성(Circular Dependency) 체인을 감지합니다.

```ts
'architecture/no-circular': {
  severity: 'error',
  options: {
    entries: ['src/**/*.ts'],  // 선택 사항: 이 파일만 스캔
    ignore: ['**/*.spec.ts'],  // 선택 사항: 이 파일은 건너뜀
    maxDepth: 5,               // 선택 사항: 긴 순환은 무시
  },
}
```

**옵션:**

| 옵션       | 타입       | 설명                        |
| ---------- | ---------- | --------------------------- |
| `entries`  | `string[]` | 스캔할 진입점의 글로브 패턴 |
| `ignore`   | `string[]` | 제외할 파일의 글로브 패턴   |
| `maxDepth` | `number`   | 보고할 최대 순환 체인 길이  |

**프로바이더(Providers):** `graph`

---

### `architecture/no-circular-packages`

`package.json`을 분석하여 워크스페이스 패키지 간의 순환 의존성을 감지합니다.

```ts
'architecture/no-circular-packages': {
  severity: 'error',
  options: {
    scope: '@myorg', // 선택 사항: 자동 감지됨
  },
}
```

**옵션:**

| 옵션    | 타입     | 설명                                      |
| ------- | -------- | ----------------------------------------- |
| `scope` | `string` | 내부 패키지로 취급할 패키지 스코프 접두사 |

**프로바이더(Providers):** `fs`, `config`
