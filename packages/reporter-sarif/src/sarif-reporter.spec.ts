import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Violation, RunSummary } from '@retemper/lodestar-types';
import { createSarifReporter, buildSarifLog, sarifReporter } from './sarif-reporter';

/** 최소 RunSummary */
function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    totalFiles: 0,
    totalRules: 0,
    violations: [],
    ruleResults: [],
    errorCount: 0,
    warnCount: 0,
    durationMs: 0,
    ...overrides,
  };
}

describe('buildSarifLog', () => {
  it('빈 위반 목록에 대해 유효한 SARIF 구조를 생성한다', () => {
    const result = buildSarifLog([], new Map());

    expect(result.version).toBe('2.1.0');
    expect(result.$schema).toContain('sarif-schema-2.1.0');
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].tool.driver.name).toBe('lodestar');
    expect(result.runs[0].results).toStrictEqual([]);
    expect(result.runs[0].tool.driver.rules).toStrictEqual([]);
  });

  it('위반을 SARIF result로 변환한다', () => {
    const violations: Violation[] = [
      {
        ruleId: 'architecture/layers',
        message: 'Layer violation: domain imports infra',
        severity: 'error',
        location: { file: 'src/domain/user.ts', line: 5, column: 1 },
      },
    ];

    const result = buildSarifLog(violations, new Map());

    expect(result.runs[0].results).toHaveLength(1);
    const sarifResult = result.runs[0].results[0];
    expect(sarifResult.ruleId).toBe('architecture/layers');
    expect(sarifResult.level).toBe('error');
    expect(sarifResult.message.text).toBe('Layer violation: domain imports infra');
    expect(sarifResult.locations?.[0].physicalLocation.artifactLocation.uri).toBe(
      'src/domain/user.ts',
    );
    expect(sarifResult.locations?.[0].physicalLocation.region?.startLine).toBe(5);
    expect(sarifResult.locations?.[0].physicalLocation.region?.startColumn).toBe(1);
  });

  it('warn severity를 SARIF warning level로 매핑한다', () => {
    const violations: Violation[] = [{ ruleId: 'test/rule', message: 'Warning', severity: 'warn' }];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].level).toBe('warning');
  });

  it('location이 없는 위반은 locations 필드를 생략한다', () => {
    const violations: Violation[] = [
      { ruleId: 'test/rule', message: 'No location', severity: 'error' },
    ];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].locations).toBeUndefined();
  });

  it('line만 있고 column이 없으면 startColumn을 생략한다', () => {
    const violations: Violation[] = [
      {
        ruleId: 'test/rule',
        message: 'msg',
        severity: 'error',
        location: { file: 'src/a.ts', line: 10 },
      },
    ];

    const result = buildSarifLog(violations, new Map());
    const region = result.runs[0].results[0].locations?.[0].physicalLocation.region;
    expect(region?.startLine).toBe(10);
    expect(region?.startColumn).toBeUndefined();
  });

  it('고유한 ruleId별로 rules 배열을 생성한다', () => {
    const violations: Violation[] = [
      { ruleId: 'a/rule', message: 'msg1', severity: 'error' },
      { ruleId: 'b/rule', message: 'msg2', severity: 'error' },
      { ruleId: 'a/rule', message: 'msg3', severity: 'error' },
    ];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].tool.driver.rules).toHaveLength(2);
    expect(result.runs[0].tool.driver.rules[0].id).toBe('a/rule');
    expect(result.runs[0].tool.driver.rules[1].id).toBe('b/rule');
  });

  it('ruleIndex가 rules 배열의 인덱스와 일치한다', () => {
    const violations: Violation[] = [
      { ruleId: 'a/rule', message: 'msg1', severity: 'error' },
      { ruleId: 'b/rule', message: 'msg2', severity: 'error' },
    ];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].ruleIndex).toBe(0);
    expect(result.runs[0].results[1].ruleIndex).toBe(1);
  });

  it('ruleMetadata에 docsUrl이 있으면 helpUri로 포함한다', () => {
    const violations: Violation[] = [{ ruleId: 'test/rule', message: 'msg', severity: 'error' }];
    const metadata = new Map([['test/rule', { docsUrl: 'https://docs.example.com/test' }]]);

    const result = buildSarifLog(violations, metadata);
    expect(result.runs[0].tool.driver.rules[0].helpUri).toBe('https://docs.example.com/test');
  });
});

describe('createSarifReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('name이 "sarif"이다', () => {
    const reporter = createSarifReporter();
    expect(reporter.name).toBe('sarif');
  });

  it('onComplete에서 SARIF JSON을 stdout에 출력한다', () => {
    const reporter = createSarifReporter();
    const violation: Violation = { ruleId: 'test/rule', message: 'Bad', severity: 'error' };

    reporter.onViolation(violation);
    reporter.onComplete(makeSummary());

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].ruleId).toBe('test/rule');
  });

  it('빈 위반이면 빈 results를 출력한다', () => {
    const reporter = createSarifReporter();
    reporter.onComplete(makeSummary());

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].results).toStrictEqual([]);
  });

  it('onRuleComplete에서 docsUrl을 수집한다', () => {
    const reporter = createSarifReporter();

    reporter.onRuleComplete!({
      ruleId: 'test/rule',
      violations: [],
      durationMs: 1,
      docsUrl: 'https://docs.example.com/test',
    });

    reporter.onViolation({ ruleId: 'test/rule', message: 'msg', severity: 'error' });
    reporter.onComplete(makeSummary());

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].tool.driver.rules[0].helpUri).toBe('https://docs.example.com/test');
  });
});

describe('sarifReporter', () => {
  it('name이 "sarif"인 ReporterFactory를 반환한다', () => {
    const factory = sarifReporter();
    expect(factory.name).toBe('sarif');
  });

  it('create()로 WorkspaceReporter를 생성한다', () => {
    const factory = sarifReporter();
    const reporter = factory.create();
    expect(reporter.name).toBe('sarif');
    expect(typeof reporter.onStart).toBe('function');
    expect(typeof reporter.onComplete).toBe('function');
  });
});
