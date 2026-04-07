import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Violation, RunSummary, RuleResultSummary } from 'lodestar';
import { createConsoleReporter } from './console';
import { createJsonReporter } from './json';

/** Create a minimal RunSummary for testing */
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

describe('createConsoleReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('has name "console"', () => {
    const reporter = createConsoleReporter();
    expect(reporter.name).toBe('console');
  });

  describe('onRuleComplete', () => {
    it('shows checkmark for passing rules', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [],
        durationMs: 5,
      };

      reporter.onRuleComplete!(result);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('✓');
      expect(output).toContain('naming-convention/file-naming');
    });

    it('shows cross for failing rules with violations inline', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'fs-layout/directory-exists',
        violations: [
          {
            ruleId: 'fs-layout/directory-exists',
            message: 'Required directory "tests" does not exist',
            severity: 'error',
          },
        ],
        durationMs: 3,
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(calls[0]).toContain('✗');
      expect(calls[0]).toContain('fs-layout/directory-exists');
      expect(calls[1]).toContain('Required directory');
    });

    it('shows warning indicator for warn-only results', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [
          {
            ruleId: 'naming-convention/file-naming',
            message: 'Bad name',
            severity: 'warn',
          },
        ],
        durationMs: 2,
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(calls[0]).toContain('!');
      expect(calls[0]).toContain('naming-convention/file-naming');
      expect(calls[1]).toContain('Bad name');
    });

    it('위반에 location이 없으면 위치 정보를 출력하지 않는다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'fs-layout/directory-exists',
        violations: [
          {
            ruleId: 'fs-layout/directory-exists',
            message: 'Missing directory',
            severity: 'error',
          },
        ],
        durationMs: 1,
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const violationLine = calls[1];
      expect(violationLine).toContain('Missing directory');
      expect(violationLine).not.toContain('at ');
    });

    it('위반에 location은 있지만 line이 없으면 파일 경로만 출력한다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [
          {
            ruleId: 'naming-convention/file-naming',
            message: 'Bad file name',
            severity: 'error',
            location: { file: 'src/MyComponent.ts' },
          },
        ],
        durationMs: 1,
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const violationLine = calls[1];
      expect(violationLine).toContain('at src/MyComponent.ts');
      expect(violationLine).not.toContain(':');
    });

    it('위반에 location과 line이 모두 있으면 파일 경로와 줄 번호를 출력한다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [
          {
            ruleId: 'naming-convention/file-naming',
            message: 'Bad file name',
            severity: 'error',
            location: { file: 'src/MyComponent.ts', line: 42 },
          },
        ],
        durationMs: 1,
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const violationLine = calls[1];
      expect(violationLine).toContain('at src/MyComponent.ts:42');
    });

    it('meta가 있으면 출력에 포함한다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [],
        durationMs: 5,
        meta: '42 files checked',
      };

      reporter.onRuleComplete!(result);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('42 files checked');
    });

    it('docsUrl이 있으면 경고에도 표시한다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'naming-convention/file-naming',
        violations: [
          {
            ruleId: 'naming-convention/file-naming',
            message: 'Bad name',
            severity: 'warn',
          },
        ],
        durationMs: 2,
        docsUrl: 'https://docs.example.com/naming',
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(calls.some((c) => c.includes('docs: https://docs.example.com/naming'))).toBe(true);
    });

    it('docsUrl이 있으면 에러에도 표시한다', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'test/rule',
        violations: [
          {
            ruleId: 'test/rule',
            message: 'Violation',
            severity: 'error',
          },
        ],
        durationMs: 1,
        docsUrl: 'https://docs.example.com/test',
      };

      reporter.onRuleComplete!(result);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(calls.some((c) => c.includes('docs: https://docs.example.com/test'))).toBe(true);
    });

    it('shows error message when rule threw', () => {
      const reporter = createConsoleReporter();
      const result: RuleResultSummary = {
        ruleId: 'broken/rule',
        violations: [],
        durationMs: 0,
        error: new Error('Parse failed'),
      };

      reporter.onRuleComplete!(result);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('✗');
      expect(output).toContain('Parse failed');
    });
  });

  describe('onComplete', () => {
    it('prints summary totals', () => {
      const reporter = createConsoleReporter();
      reporter.onComplete(makeSummary({ errorCount: 3, warnCount: 2, durationMs: 150.5 }));

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const summary = calls.find((c) => c.includes('errors'));
      expect(summary).toContain('3 errors');
      expect(summary).toContain('2 warnings');
      expect(summary).toContain('151ms');
    });

    it('prints zero counts', () => {
      const reporter = createConsoleReporter();
      reporter.onComplete(makeSummary({ durationMs: 0 }));

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const summary = calls.find((c) => c.includes('errors'));
      expect(summary).toContain('0 errors');
      expect(summary).toContain('0 warnings');
    });

    it('ruleResults가 있으면 위반 없는 규칙 수를 계산한다', () => {
      const reporter = createConsoleReporter();
      reporter.onComplete(
        makeSummary({
          totalRules: 3,
          ruleResults: [
            { ruleId: 'a', violations: [], durationMs: 1 },
            {
              ruleId: 'b',
              violations: [{ ruleId: 'b', message: 'err', severity: 'error' }],
              durationMs: 1,
            },
            { ruleId: 'c', violations: [], durationMs: 1 },
          ],
          errorCount: 1,
          warnCount: 0,
          durationMs: 3,
        }),
      );

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const line = calls.find((c) => c.includes('rules passed'));
      expect(line).toContain('2 rules passed');
    });
  });

  describe('onPackageStart', () => {
    it('prints package name', () => {
      const reporter = createConsoleReporter();
      reporter.onPackageStart!({ name: '@lodestar/core', dir: '/root/packages/core' });

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('@lodestar/core');
    });
  });

  describe('no-op 메서드', () => {
    it('onStart는 예외를 던지지 않는다', () => {
      const reporter = createConsoleReporter();
      expect(() => reporter.onStart({ rootDir: '/root', ruleCount: 5 })).not.toThrow();
    });

    it('onRuleStart는 예외를 던지지 않는다', () => {
      const reporter = createConsoleReporter();
      expect(() => reporter.onRuleStart!('test/rule')).not.toThrow();
    });

    it('onPackageComplete는 예외를 던지지 않는다', () => {
      const reporter = createConsoleReporter();
      expect(() =>
        reporter.onPackageComplete!(undefined as never, undefined as never),
      ).not.toThrow();
    });

    it('onViolation은 예외를 던지지 않는다', () => {
      const reporter = createConsoleReporter();
      expect(() =>
        reporter.onViolation({ ruleId: 'test', message: 'msg', severity: 'error' }),
      ).not.toThrow();
    });
  });

  describe('onComplete 폴백 분기', () => {
    it('ruleResults가 없으면 totalRules 기반으로 passed를 계산한다 (에러 있음)', () => {
      const reporter = createConsoleReporter();
      const summary = {
        totalFiles: 0,
        totalRules: 5,
        violations: [],
        errorCount: 2,
        warnCount: 0,
        durationMs: 10,
      } as unknown as RunSummary;

      reporter.onComplete(summary);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const line = calls.find((c) => c.includes('rules passed'));
      expect(line).toContain('4 rules passed');
    });

    it('ruleResults가 없으면 totalRules 기반으로 passed를 계산한다 (에러 없음)', () => {
      const reporter = createConsoleReporter();
      const summary = {
        totalFiles: 0,
        totalRules: 3,
        violations: [],
        errorCount: 0,
        warnCount: 1,
        durationMs: 5,
      } as unknown as RunSummary;

      reporter.onComplete(summary);

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const line = calls.find((c) => c.includes('rules passed'));
      expect(line).toContain('3 rules passed');
    });
  });
});

describe('createJsonReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('has name "json"', () => {
    const reporter = createJsonReporter();
    expect(reporter.name).toBe('json');
  });

  it('outputs violations and summary as JSON', () => {
    const reporter = createJsonReporter();
    const violation: Violation = { ruleId: 'test/rule', message: 'Bad', severity: 'error' };

    reporter.onViolation(violation);
    reporter.onComplete(
      makeSummary({
        totalRules: 1,
        violations: [violation],
        errorCount: 1,
        durationMs: 50,
      }),
    );

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0].ruleId).toBe('test/rule');
  });

  it('outputs empty violations array when clean', () => {
    const reporter = createJsonReporter();
    reporter.onComplete(makeSummary());

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.violations).toStrictEqual([]);
  });

  it('onStart는 예외를 던지지 않는다', () => {
    const reporter = createJsonReporter();
    expect(() => reporter.onStart({ rootDir: '/root', ruleCount: 3 })).not.toThrow();
  });
});
