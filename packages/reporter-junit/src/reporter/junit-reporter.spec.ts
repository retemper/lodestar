import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunSummary } from '@retemper/lodestar-types';
import { createJunitReporter, buildJunitXml, escapeXml, junitReporter } from './junit-reporter';

/** Minimal RunSummary */
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
  it('escapes special characters', () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;',
    );
  });

  it('returns original when there are no special characters', () => {
    expect(escapeXml('hello world')).toBe('hello world');
  });
});

describe('buildJunitXml', () => {
  it('generates valid XML for empty entries', () => {
    const xml = buildJunitXml([], makeSummary());

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('tests="0"');
    expect(xml).toContain('</testsuites>');
  });

  it('outputs passed rules as self-closing testcase', () => {
    const entries = [{ ruleId: 'test/rule', violations: [], durationMs: 5 }];
    const xml = buildJunitXml(entries, makeSummary({ durationMs: 5 }));

    expect(xml).toContain('<testcase name="test/rule"');
    expect(xml).toContain('/>');
    expect(xml).not.toContain('<failure');
  });

  it('outputs failure element when error violations exist', () => {
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

  it('outputs via system-out when only warnings exist', () => {
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

  it('outputs error element when rule throws', () => {
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

  it('outputs without file path when violation has no location', () => {
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

  it('converts time to seconds', () => {
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

  it('name is "junit"', () => {
    const reporter = createJunitReporter();
    expect(reporter.name).toBe('junit');
  });

  it('outputs JUnit XML to stdout in onComplete', () => {
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
  it('returns a ReporterFactory with name "junit"', () => {
    const factory = junitReporter();
    expect(factory.name).toBe('junit');
  });

  it('creates WorkspaceReporter via create()', () => {
    const factory = junitReporter();
    const reporter = factory.create();
    expect(reporter.name).toBe('junit');
  });
});
