import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Violation, RunSummary } from '@retemper/lodestar-types';
import { createSarifReporter, buildSarifLog, sarifReporter } from './sarif-reporter';

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

describe('buildSarifLog', () => {
  it('generates valid SARIF structure for empty violations', () => {
    const result = buildSarifLog([], new Map());

    expect(result.version).toBe('2.1.0');
    expect(result.$schema).toContain('sarif-schema-2.1.0');
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].tool.driver.name).toBe('lodestar');
    expect(result.runs[0].results).toStrictEqual([]);
    expect(result.runs[0].tool.driver.rules).toStrictEqual([]);
  });

  it('converts violations to SARIF results', () => {
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

  it('maps warn severity to SARIF warning level', () => {
    const violations: Violation[] = [{ ruleId: 'test/rule', message: 'Warning', severity: 'warn' }];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].level).toBe('warning');
  });

  it('omits locations field for violations without location', () => {
    const violations: Violation[] = [
      { ruleId: 'test/rule', message: 'No location', severity: 'error' },
    ];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].locations).toBeUndefined();
  });

  it('omits startColumn when line exists but column does not', () => {
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

  it('creates rules array by unique ruleId', () => {
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

  it('ruleIndex matches the index of the rules array', () => {
    const violations: Violation[] = [
      { ruleId: 'a/rule', message: 'msg1', severity: 'error' },
      { ruleId: 'b/rule', message: 'msg2', severity: 'error' },
    ];

    const result = buildSarifLog(violations, new Map());
    expect(result.runs[0].results[0].ruleIndex).toBe(0);
    expect(result.runs[0].results[1].ruleIndex).toBe(1);
  });

  it('includes helpUri when ruleMetadata has docsUrl', () => {
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

  it('name is "sarif"', () => {
    const reporter = createSarifReporter();
    expect(reporter.name).toBe('sarif');
  });

  it('outputs SARIF JSON to stdout in onComplete', () => {
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

  it('outputs empty results for empty violations', () => {
    const reporter = createSarifReporter();
    reporter.onComplete(makeSummary());

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].results).toStrictEqual([]);
  });

  it('collects docsUrl in onRuleComplete', () => {
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
  it('returns a ReporterFactory with name "sarif"', () => {
    const factory = sarifReporter();
    expect(factory.name).toBe('sarif');
  });

  it('creates WorkspaceReporter via create()', () => {
    const factory = sarifReporter();
    const reporter = factory.create();
    expect(reporter.name).toBe('sarif');
    expect(typeof reporter.onStart).toBe('function');
    expect(typeof reporter.onComplete).toBe('function');
  });
});
