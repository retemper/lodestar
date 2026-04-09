# CLI 레퍼런스

## `lodestar check`

프로젝트에 대해 설정된 모든 규칙(Rule)을 실행합니다.

```sh
npx lodestar check [options]
```

| 플래그           | 타입                | 기본값    | 설명                                                                                                                |
| ---------------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `--format`       | `string`            | `console` | 출력 형식. 선택지: `console`, `json`, `sarif`, `junit`                                                              |
| `--workspace`    | `boolean`           | 자동 감지 | 워크스페이스 모드 강제 활성화                                                                                       |
| `--no-workspace` | `boolean`           |           | 워크스페이스 모드 비활성화                                                                                          |
| `--rule`         | `string[]`          | 전체 규칙 | 특정 규칙만 실행. 정확한 일치(`naming-convention/file-naming`) 및 접두사 와일드카드(`architecture/*`) 지원          |
| `--fix`          | `boolean`           | `false`   | 가능한 경우 위반 사항 자동 수정                                                                                     |
| `--cache`        | `boolean`           | `true`    | 빠른 재실행을 위한 디스크 캐시 활성화                                                                               |
| `--clear-cache`  | `boolean`           | `false`   | 실행 전 캐시 삭제                                                                                                   |
| `--changed`      | `string \| boolean` |           | 주어진 git ref 이후 변경된 파일만 검사 (ref 생략 시 HEAD 기준). 간접 영향 범위(transitive impact scope)를 자동 계산 |
| `--concurrency`  | `number`            | `4`       | 병렬로 검사할 패키지 수 (워크스페이스 모드 전용)                                                                    |

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

### 증분 검사(Incremental Checking)

`--changed` 플래그는 증분 모드를 활성화합니다. Lodestar는 변경 사항에 영향받는 파일(모듈 그래프를 통한 간접 의존자)을 계산하고 해당 파일만 검사합니다:

```sh
# HEAD 이후 변경된 파일 검사 (커밋되지 않은 변경 사항)
npx lodestar check --changed

# 특정 브랜치 또는 커밋 이후 변경된 파일 검사
npx lodestar check --changed main
npx lodestar check --changed abc1234
```

### 캐싱(Caching)

Lodestar는 규칙 실행 결과를 디스크에 캐시합니다. 마지막 실행 이후 변경되지 않은 파일은 자동으로 건너뜁니다:

```sh
# 캐싱은 기본적으로 활성화됨
npx lodestar check

# 캐싱 비활성화
npx lodestar check --no-cache

# 캐시를 삭제하고 처음부터 다시 실행
npx lodestar check --clear-cache
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

`defineConfig`와 `@retemper/lodestar-plugin-architecture`를 임포트하고, 샘플 `architecture/layers` 규칙이 사전 구성된 시작 설정을 생성합니다:

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
| `--serve`  | `boolean` | `false`   | 브라우저에서 인터랙티브 그래프 뷰어 시작                                                |
| `--port`   | `number`  | `4040`    | 인터랙티브 그래프 서버 포트 (`--serve`와 함께 사용)                                     |

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

**인터랙티브 모드** (`--serve`)는 시각적 그래프 탐색기를 제공하는 로컬 HTTP 서버를 시작합니다. 뷰어는 검색, 필터링, 레이어별 색상 구분, 노드 선택을 지원합니다:

```sh
npx lodestar graph --serve
npx lodestar graph --serve --port 8080
```

---

## `lodestar watch`

Watch 모드로 규칙을 실행합니다 — 파일을 저장할 때마다 영향받는 파일을 다시 검사합니다.

```sh
npx lodestar watch [options]
```

| 플래그       | 타입       | 기본값    | 설명                                                                      |
| ------------ | ---------- | --------- | ------------------------------------------------------------------------- |
| `--format`   | `string`   | `console` | 출력 형식. 선택지: `console`, `json`                                      |
| `--rule`     | `string[]` | 전체 규칙 | 특정 규칙만 실행. 정확한 일치 및 접두사 와일드카드(`architecture/*`) 지원 |
| `--fix`      | `boolean`  | `false`   | 가능한 경우 위반 사항 자동 수정                                           |
| `--cache`    | `boolean`  | `true`    | 빠른 재실행을 위한 디스크 캐시 활성화                                     |
| `--debounce` | `number`   | `300`     | 디바운스 간격 (밀리초)                                                    |

각 파일 변경 시, lodestar는 간접 영향 범위를 계산하고 영향받는 규칙만 다시 실행합니다. 각 주기 후 요약이 출력됩니다:

```
Watch: 1 changed → 3 in scope | 0 errors, 0 warnings (42ms)
  Files: src/core/engine.ts
```

`Ctrl+C`로 종료합니다.

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
