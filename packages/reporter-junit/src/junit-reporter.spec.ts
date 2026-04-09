import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunSummary } from '@retemper/lodestar-types';
import { createJunitReporter, buildJunitXml, escapeXml, junitReporter } from './junit-reporter';

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

describe('escapeXml', () => {
  it('특수 문자를 이스케이프한다', () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;',
    );
  });

  it('특수 문자가 없으면 원본을 반환한다', () => {
    expect(escapeXml('hello world')).toBe('hello world');
  });
});

describe('buildJunitXml', () => {
  it('빈 entries에 대해 유효한 XML을 생성한다', () => {
    const xml = buildJunitXml([], makeSummary());

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('tests="0"');
    expect(xml).toContain('</testsuites>');
  });

  it('통과한 규칙은 self-closing testcase로 출력한다', () => {
    const entries = [{ ruleId: 'test/rule', violations: [], durationMs: 5 }];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 5 }));

    expect(xml).toContain('<testcase name="test/rule"');
    expect(xml).toContain('/>');
    expect(xml).not.toContain('<failure');
  });

  it('에러 위반이 있으면 failure 요소를 출력한다', () => {
    const entries = [
      {
        ruleId: 'arch/layers',
        violations: [
          {
            ruleId: 'arch/layers',
            message: 'domain imports infra',
            severity: 'error' as const,
            location: { file: 'src/domain.ts', line: 10 },
          },
        ],
        durationMs: 3,
      },
    ];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 3 }));

    expect(xml).toContain('<failure');
    expect(xml).toContain('domain imports infra at src/domain.ts:10');
    expect(xml).toContain('failures="1"');
  });

  it('경고만 있으면 system-out으로 출력한다', () => {
    const entries = [
      {
        ruleId: 'test/warn',
        violations: [
          { ruleId: 'test/warn', message: 'Consider refactoring', severity: 'warn' as const },
        ],
        durationMs: 1,
      },
    ];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 1 }));

    expect(xml).toContain('<system-out>');
    expect(xml).toContain('Consider refactoring');
    expect(xml).not.toContain('<failure');
  });

  it('규칙이 에러를 throw하면 error 요소를 출력한다', () => {
    const entries = [
      {
        ruleId: 'broken/rule',
        violations: [],
        durationMs: 0,
        error: new Error('Parse failed'),
      },
    ];
    const xml = buildJunitXml(entries, makeSummary());

    expect(xml).toContain('<error');
    expect(xml).toContain('Parse failed');
    expect(xml).toContain('errors="1"');
  });

  it('location이 없는 위반은 파일 경로 없이 출력한다', () => {
    const entries = [
      {
        ruleId: 'test/rule',
        violations: [{ ruleId: 'test/rule', message: 'No location', severity: 'error' as const }],
        durationMs: 1,
      },
    ];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 1 }));

    expect(xml).toContain('No location');
    expect(xml).not.toContain(' at ');
  });

  it('시간을 초 단위로 변환한다', () => {
    const entries = [{ ruleId: 'test/rule', violations: [], durationMs: 1500 }];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 1500 }));

    expect(xml).toContain('time="1.500"');
  });
});

describe('createJunitReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('name이 "junit"이다', () => {
    const reporter = createJunitReporter();
    expect(reporter.name).toBe('junit');
  });

  it('onComplete에서 JUnit XML을 stdout에 출력한다', () => {
    const reporter = createJunitReporter();

    reporter.onRuleComplete!({
      ruleId: 'test/rule',
      violations: [{ ruleId: 'test/rule', message: 'Bad', severity: 'error' }],
      durationMs: 5,
    });
    reporter.onComplete(makeSummary({ durationMs: 5 }));

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(output).toContain('<?xml');
    expect(output).toContain('test/rule');
    expect(output).toContain('<failure');
  });
});

describe('junitReporter', () => {
  it('name이 "junit"인 ReporterFactory를 반환한다', () => {
    const factory = junitReporter();
    expect(factory.name).toBe('junit');
  });

  it('create()로 WorkspaceReporter를 생성한다', () => {
    const factory = junitReporter();
    const reporter = factory.create();
    expect(reporter.name).toBe('junit');
  });
});
