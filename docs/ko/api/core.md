---
description: '@retemper/lodestar-core API 레퍼런스 — 규칙을 실행하고 결과를 생성하는 엔진.'
---

# @retemper/lodestar-core

규칙 엔진(Rule Engine), 러너(Runner), 플러그인 리졸버(Plugin Resolver) 및 프로바이더(Provider)를 담당합니다.

```ts
import { run, runWorkspace, createProviders } from '@retemper/lodestar-core';
```

## `run(options)`

단일 프로젝트에 대해 모든 규칙(Rule)을 실행합니다.

```ts
const summary = await run({
  config: resolvedConfig,
  reporter: myReporter, // 선택 사항
  fix: true, // 선택 사항 -- 위반 사항 자동 수정
  cache: cacheProvider, // 선택 사항 -- 디스크 캐시 프로바이더
  scope: fileSet, // 선택 사항 -- 검사할 파일을 제한하는 Set<string>
});
```

`RunSummary`를 반환합니다:

```ts
interface RunSummary {
  readonly totalFiles: number;
  readonly totalRules: number;
  readonly violations: readonly Violation[];
  readonly ruleResults: readonly RuleResultSummary[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly durationMs: number;
}
```

## `runWorkspace(options)`

워크스페이스 모드(모노레포)에서 규칙을 실행합니다.

```ts
const summary = await runWorkspace({
  rootDir: '/monorepo/root',
  rootConfig: writtenConfig,
  reporter: workspaceReporter, // 선택 사항
  fix: true, // 선택 사항
  cache: cacheProvider, // 선택 사항
  concurrency: 4, // 선택 사항 -- 병렬 패키지 제한 (기본값: 4)
});
```

패키지별 결과가 포함된 `WorkspaceSummary`를 반환합니다.

## `createProviders(rootDir)`

주어진 루트 디렉토리에 대한 프로바이더 맵을 생성합니다.

```ts
const providers = createProviders('/project/root');
// providers.fs, providers.graph, providers.ast, providers.config
```

## `createLogger(options?)`

레벨 필터링이 포함된 구조화된 로거를 생성합니다.

```ts
import { createLogger, silentLogger } from '@retemper/lodestar-core';

const logger = createLogger({ level: 'warn' }); // warn + error만 출력
logger.info('건너뜀'); // 출력되지 않음
logger.error('출력됨'); // stderr로 출력됨
```

| 옵션    | 타입                    | 기본값                 | 설명                                                          |
| ------- | ----------------------- | ---------------------- | ------------------------------------------------------------- |
| `level` | `LogLevel`              | `'info'`               | 출력할 최소 레벨 (`debug`, `info`, `warn`, `error`, `silent`) |
| `write` | `(msg: string) => void` | `process.stderr.write` | 커스텀 출력 함수                                              |

`silentLogger`는 모든 메시지를 무시하는 no-op 로거입니다. 테스트에 유용합니다.

## `createDiskCacheProvider(rootDir)`

규칙 실행 결과 캐싱을 위한 파일 시스템 캐시 프로바이더를 생성합니다.

```ts
import { createDiskCacheProvider } from '@retemper/lodestar-core';

const cache = createDiskCacheProvider('/project/root');
await cache.clear(); // 캐시 수동 삭제
```

캐시는 파일 내용 해시를 키로 사용하여 규칙 결과를 저장합니다. 변경되지 않은 파일은 이후 실행에서 자동으로 건너뜁니다.

## `createWatcher(options)`

프로젝트의 파일 변경을 감시하고 각 변경 시 규칙을 다시 실행합니다.

```ts
import { createWatcher } from '@retemper/lodestar-core';

const handle = createWatcher({
  config: resolvedConfig,
  debounceMs: 300,
  logger,
  onCycle(summary) {
    console.log(`${summary.changedFiles.length} changed, ${summary.errorCount} errors`);
  },
});

// 나중에: 감시 중지
handle.close();
```

## `getChangedFiles(rootDir, base?)`

`git diff`를 사용하여 git ref 이후 변경된 파일을 가져옵니다.

```ts
import { getChangedFiles } from '@retemper/lodestar-core';

const files = await getChangedFiles('/project', 'main');
// ['src/a.ts', 'src/b.ts']
```

## `computeImpactScope(changedFiles, graph)`

모듈 의존성 그래프를 사용하여 변경된 파일 목록에 의해 영향받는 파일의 전이적(transitive) 집합을 계산합니다.

```ts
import { computeImpactScope } from '@retemper/lodestar-core';

const scope = computeImpactScope(changedFiles, moduleGraph);
// 영향받는 모든 파일의 Set<string>
```

---

## Reporter

`Reporter` 인터페이스는 규칙 실행 진행 상황과 결과를 포맷하고 출력합니다. lodestar는 두 가지 내장 리포터(`console`, `json`)를 제공하며, 이 인터페이스를 구현하여 커스텀 리포터를 만들 수 있습니다.

```ts
interface Reporter {
  readonly name: string;
  onStart(config: { rootDir: string; ruleCount: number }): void;
  onRuleStart?(ruleId: string): void;
  onRuleComplete?(result: RuleResultSummary): void;
  onViolation(violation: Violation): void;
  onComplete(summary: RunSummary): void;
}
```

### 콜백 생명주기 (Callback Lifecycle)

1. `onStart` -- 규칙 실행 전 한 번 호출되며, 프로젝트 루트와 총 규칙 수가 전달됨
2. `onRuleStart` -- 각 규칙 실행 시작 전 호출 (선택 사항)
3. `onViolation` -- 규칙이 위반 사항을 보고할 때마다 호출
4. `onRuleComplete` -- 각 규칙 실행 완료 후 호출 (선택 사항)
5. `onComplete` -- 모든 규칙 완료 후 집계된 `RunSummary`와 함께 호출

### `RuleResultSummary`

`onRuleComplete`에 규칙별 상세 정보와 함께 전달됩니다:

```ts
interface RuleResultSummary {
  readonly ruleId: string;
  readonly violations: readonly Violation[];
  readonly durationMs: number;
  readonly meta?: string; // 예: "14 files", "0 cycles"
  readonly docsUrl?: string; // 규칙의 문서 URL
  readonly error?: Error; // 규칙이 예외를 던진 경우 설정
}
```

## `WorkspaceReporter`

`Reporter`를 확장하여 모노레포 실행을 위한 워크스페이스 인식 콜백을 추가합니다:

```ts
interface WorkspaceReporter extends Reporter {
  onPackageStart?(pkg: WorkspacePackage): void;
  onPackageComplete?(pkg: WorkspacePackage, summary: RunSummary): void;
}
```

`WorkspacePackage`는 다음과 같습니다:

```ts
interface WorkspacePackage {
  readonly name: string; // package.json의 패키지 이름
  readonly dir: string; // 패키지 디렉토리의 절대 경로
}
```

## 커스텀 리포터 만들기 (Creating a Custom Reporter)

리포터는 `Reporter` 인터페이스를 구현하는 일반 객체입니다. 최소 예시:

```ts
import type { Reporter, Violation, RunSummary, RuleResultSummary } from '@retemper/lodestar';

function createMyReporter(): Reporter {
  return {
    name: 'my-reporter',

    onStart({ ruleCount }) {
      console.error(`Running ${ruleCount} rules...`);
    },

    onRuleComplete(result: RuleResultSummary) {
      const status = result.violations.length === 0 ? 'PASS' : 'FAIL';
      console.error(`  [${status}] ${result.ruleId} (${result.durationMs}ms)`);
    },

    onViolation(violation: Violation) {
      const loc = violation.location ? ` at ${violation.location.file}` : '';
      console.error(`    ${violation.severity}: ${violation.message}${loc}`);
    },

    onComplete(summary: RunSummary) {
      console.error(
        `Done: ${summary.errorCount} errors, ${summary.warnCount} warnings in ${summary.durationMs}ms`,
      );
    },
  };
}
```

### 내장 리포터 (Built-in Reporters)

| 리포터                    | 출력   | 설명                                                                                                                                                |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createConsoleReporter()` | stderr | ANSI 색상, 규칙별 통과/실패 상태, 메타데이터, 소요 시간이 포함된 사람이 읽을 수 있는 출력. `WorkspaceReporter`를 구현하여 패키지 헤더를 표시합니다. |
| `createJsonReporter()`    | stdout | 모든 위반 사항을 수집하고 완료 시 단일 JSON 객체를 출력합니다. CI 파이프라인 및 프로그래밍 방식 소비에 유용합니다.                                  |

```ts
import { createConsoleReporter } from '@retemper/lodestar-cli';
import { createJsonReporter } from '@retemper/lodestar-cli';
```
