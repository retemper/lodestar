# CLI 레퍼런스

## `lodestar check`

프로젝트에 대해 설정된 모든 규칙(Rule)을 실행합니다.

```sh
npx lodestar check [options]
```

| 플래그           | 타입       | 기본값    | 설명                                                                                                       |
| ---------------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `--format`       | `string`   | `console` | 출력 형식. 선택지: `console`, `json`                                                                       |
| `--workspace`    | `boolean`  | 자동 감지 | 워크스페이스 모드 강제 활성화                                                                              |
| `--no-workspace` | `boolean`  |           | 워크스페이스 모드 비활성화                                                                                 |
| `--rule`         | `string[]` | 전체 규칙 | 특정 규칙만 실행. 정확한 일치(`naming-convention/file-naming`) 및 접두사 와일드카드(`architecture/*`) 지원 |
| `--fix`          | `boolean`  | `false`   | 가능한 경우 위반 사항 자동 수정                                                                            |

`--workspace`를 생략하면 `pnpm-workspace.yaml` 또는 `package.json`의 workspaces 필드를 확인하여 워크스페이스 모드를 자동 감지합니다. 워크스페이스 모드에서는 발견된 각 패키지와 루트에 대해 규칙을 실행한 뒤 집계 요약을 출력합니다.

`--rule` 플래그는 하나 이상의 규칙 식별자를 받습니다. `/*`로 끝나는 패턴은 해당 접두사의 모든 규칙과 매칭됩니다:

```sh
# 단일 규칙 실행
npx lodestar check --rule architecture/no-circular

# 모든 architecture 규칙 실행
npx lodestar check --rule "architecture/*"

# 여러 특정 규칙 실행
npx lodestar check --rule architecture/layers --rule naming-convention/file-naming
```

**종료 코드:**

| 코드 | 의미                    |
| ---- | ----------------------- |
| `0`  | 에러 없음 (경고는 허용) |
| `1`  | 하나 이상의 에러 발견   |

---

## `lodestar init`

현재 디렉토리에 `lodestar.config.ts` 파일을 생성합니다.

```sh
npx lodestar init
```

`defineConfig`와 `@lodestar/plugin-architecture`를 임포트하고, 샘플 `architecture/layers` 규칙이 사전 구성된 시작 설정을 생성합니다:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

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

---

## `lodestar setup`

모든 어댑터(Adapter)의 `verifySetup()`을 실행하고 가능한 경우 문제를 자동 수정합니다.

```sh
npx lodestar setup
```

이 명령은 `lodestar.config.ts`를 로드하고, `verifySetup` 메서드를 제공하는 모든 어댑터를 수집하여 순차적으로 실행합니다. 어댑터가 반환한 각 위반 사항에 대해 `fix`가 사용 가능하면 자동으로 적용됩니다. 이는 도구 설정 파일(예: `.prettierrc`, git hooks)이 lodestar 설정과 동기화되어 있는지 확인하는 데 유용합니다.

---

## `lodestar graph`

프로젝트 의존성 그래프(Dependency Graph)를 시각적 형식으로 출력합니다.

```sh
npx lodestar graph [options]
```

| 플래그     | 타입      | 기본값    | 설명                                                                                    |
| ---------- | --------- | --------- | --------------------------------------------------------------------------------------- |
| `--scope`  | `string`  | 전체 파일 | 이 경로 접두사와 일치하는 파일만 표시 (예: `src/domain`)                                |
| `--format` | `string`  | `mermaid` | 출력 형식. 선택지: `mermaid`, `dot`                                                     |
| `--layers` | `boolean` | `false`   | 파일 수준 대신 레이어 수준 아키텍처 그래프 표시. 설정에 `architecture/layers` 규칙 필요 |

**파일 수준 모드** (기본값)는 소스 파일 간의 모든 임포트 엣지를 출력합니다. `--scope`를 사용하여 특정 디렉토리로 출력을 제한할 수 있습니다:

```sh
npx lodestar graph --scope src/domain
npx lodestar graph --format dot | dot -Tsvg -o deps.svg
```

**레이어 수준 모드** (`--layers`)는 파일 수준 의존성을 레이어 간 엣지로 집계합니다. 허용된 임포트는 실선 화살표로, 위반은 "violation" 레이블과 함께 빨간 점선으로 표시됩니다:

```sh
npx lodestar graph --layers
npx lodestar graph --layers --format dot
```

---

## `lodestar impact <file>`

주어진 파일을 변경했을 때 영향받는 모든 파일을 의존자 그래프(Dependents Graph)에 대한 BFS를 통해 보여줍니다.

```sh
npx lodestar impact <file> [options]
```

| 플래그    | 타입      | 기본값   | 설명                                          |
| --------- | --------- | -------- | --------------------------------------------- |
| `<file>`  | `string`  | **필수** | 분석 대상 파일 (프로젝트 루트 기준 상대 경로) |
| `--json`  | `boolean` | `false`  | 사람이 읽을 수 있는 텍스트 대신 JSON으로 출력 |
| `--depth` | `number`  | 무제한   | 최대 BFS 순회 깊이                            |

기본 출력은 직접 의존자(depth 1)와 간접 의존자(depth > 1)를 경유 경로와 함께 나열합니다:

```sh
npx lodestar impact src/core/engine.ts
npx lodestar impact src/core/engine.ts --depth 2
npx lodestar impact src/core/engine.ts --json
```

JSON 출력 구조:

```json
{
  "target": "src/core/engine.ts",
  "directDependents": ["src/cli/commands/check.ts"],
  "transitiveDependents": [{ "file": "src/cli/index.ts", "via": "src/cli/commands/check.ts" }],
  "totalAffected": 2
}
```
