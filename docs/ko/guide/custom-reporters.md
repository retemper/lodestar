# 커스텀 Reporter

Reporter는 lodestar가 결과를 표시하는 방식을 제어합니다. Lodestar는 두 가지 내장 reporter(`console`과 `json`)를 제공하며, 직접 작성할 수도 있습니다.

## 내장 Reporter

| Reporter  | 플래그                | 출력   | 용도                                  |
| --------- | --------------------- | ------ | ------------------------------------- |
| `console` | (기본값)              | stderr | 사람이 읽기 쉬운 터미널 출력          |
| `json`    | `--format json`       | stdout | CI 파이프라인용 기계 판독 출력        |

## Reporter 인터페이스

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

### 라이프사이클

1. **`onStart`** — 규칙 실행 전 한 번 호출됩니다. 루트 디렉토리와 총 규칙 수를 받습니다.
2. **`onRuleStart`** — _(선택)_ 각 규칙 시작 전 호출됩니다.
3. **`onViolation`** — 규칙이 위반을 보고할 때마다 호출됩니다.
4. **`onRuleComplete`** — _(선택)_ 각 규칙 완료 후 호출됩니다. 위반 사항, 소요 시간, 메타데이터를 받습니다.
5. **`onComplete`** — 모든 규칙 완료 후 호출됩니다. 전체 요약을 받습니다.

### 주요 타입

```ts
interface RuleResultSummary {
  readonly ruleId: string;
  readonly violations: readonly Violation[];
  readonly durationMs: number;
  readonly meta?: string;      // 예: "14 files", "0 cycles"
  readonly docsUrl?: string;
  readonly error?: Error;
}

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

## 커스텀 Reporter 작성

### 최소 예시

```ts
import type { Reporter, RunSummary } from '@retemper/lodestar';

function createMyReporter(): Reporter {
  return {
    name: 'my-reporter',

    onStart({ ruleCount }) {
      console.error(`Running ${ruleCount} rules...`);
    },

    onRuleComplete(result) {
      const status = result.violations.length === 0 ? 'PASS' : 'FAIL';
      console.error(`  [${status}] ${result.ruleId} (${result.durationMs}ms)`);
    },

    onViolation(violation) {
      const loc = violation.location ? ` at ${violation.location.file}` : '';
      console.error(`    ${violation.severity}: ${violation.message}${loc}`);
    },

    onComplete(summary) {
      console.error(
        `Done: ${summary.errorCount} errors, ${summary.warnCount} warnings in ${summary.durationMs}ms`,
      );
    },
  };
}
```

### JUnit XML Reporter

CI 시스템용 JUnit XML을 생성하는 reporter:

```ts
import type { Reporter, RuleResultSummary, RunSummary, Violation } from '@retemper/lodestar';

function createJUnitReporter(): Reporter {
  const results: RuleResultSummary[] = [];

  return {
    name: 'junit',

    onStart() {},

    onViolation() {},

    onRuleComplete(result) {
      results.push(result);
    },

    onComplete(summary) {
      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<testsuites tests="${summary.totalRules}" failures="${summary.errorCount}" time="${(summary.durationMs / 1000).toFixed(3)}">`,
        '  <testsuite name="lodestar">',
      ];

      for (const result of results) {
        if (result.violations.length === 0) {
          lines.push(`    <testcase name="${result.ruleId}" time="${(result.durationMs / 1000).toFixed(3)}" />`);
        } else {
          lines.push(`    <testcase name="${result.ruleId}" time="${(result.durationMs / 1000).toFixed(3)}">`);
          for (const v of result.violations) {
            const loc = v.location ? `${v.location.file}:${v.location.line ?? 0}` : '';
            lines.push(`      <failure message="${escapeXml(v.message)}" type="${v.severity}">${escapeXml(loc)}</failure>`);
          }
          lines.push('    </testcase>');
        }
      }

      lines.push('  </testsuite>', '</testsuites>');
      console.log(lines.join('\n'));
    },
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

## 커스텀 Reporter 사용

`run()` 함수에 reporter를 전달하세요:

```ts
import { run, loadConfigFile, resolveConfig } from '@retemper/lodestar';

const written = await loadConfigFile('lodestar.config.ts');
const config = await resolveConfig(written);

const summary = await run({
  config,
  reporter: createMyReporter(),
});
```

## 워크스페이스 Reporter

모노레포 지원을 위해 워크스페이스 콜백으로 reporter를 확장하세요:

```ts
interface WorkspaceReporter extends Reporter {
  onPackageStart?(pkg: WorkspacePackage): void;
  onPackageComplete?(pkg: WorkspacePackage, summary: RunSummary): void;
}

interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}
```

이 콜백은 워크스페이스 실행에서 각 패키지 전후에 호출됩니다.
