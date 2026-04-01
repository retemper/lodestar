import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Violation, RunSummary } from '@lodestar/types';
import { createConsoleReporter } from './console.js';
import { createJsonReporter } from './json.js';

describe('createConsoleReporter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('has name "console"', () => {
    const reporter = createConsoleReporter();
    expect(reporter.name).toBe('console');
  });

  describe('onStart', () => {
    it('prints the number of rules to run', () => {
      const reporter = createConsoleReporter();
      reporter.onStart({ rootDir: '/root', ruleCount: 5 });

      expect(console.error).toHaveBeenCalledWith('Running 5 rules...\n');
    });

    it('prints 0 when rule count is 0', () => {
      const reporter = createConsoleReporter();
      reporter.onStart({ rootDir: '/root', ruleCount: 0 });

      expect(console.error).toHaveBeenCalledWith('Running 0 rules...\n');
    });
  });

  describe('onViolation', () => {
    it('displays error severity as ERROR', () => {
      const reporter = createConsoleReporter();
      const violation: Violation = {
        ruleId: 'test/rule',
        message: 'Something wrong',
        severity: 'error',
        location: { file: 'src/app.ts', line: 10, column: 5 },
      };

      reporter.onViolation(violation);

      expect(console.error).toHaveBeenCalledWith(
        '  ERROR  src/app.ts:10:5  Something wrong  [test/rule]',
      );
    });

    it('displays warn severity as WARN', () => {
      const reporter = createConsoleReporter();
      const violation: Violation = {
        ruleId: 'test/rule',
        message: 'Minor issue',
        severity: 'warn',
        location: { file: 'src/index.ts', line: 1, column: 0 },
      };

      reporter.onViolation(violation);

      expect(console.error).toHaveBeenCalledWith(
        '  WARN  src/index.ts:1:0  Minor issue  [test/rule]',
      );
    });

    it('displays (project) when location is absent', () => {
      const reporter = createConsoleReporter();
      const violation: Violation = {
        ruleId: 'test/rule',
        message: 'Project level issue',
        severity: 'error',
      };

      reporter.onViolation(violation);

      expect(console.error).toHaveBeenCalledWith(
        '  ERROR  (project)  Project level issue  [test/rule]',
      );
    });

    it('displays 0 when location has no line', () => {
      const reporter = createConsoleReporter();
      const violation: Violation = {
        ruleId: 'test/rule',
        message: 'Issue',
        severity: 'error',
        location: { file: 'src/app.ts' },
      };

      reporter.onViolation(violation);

      expect(console.error).toHaveBeenCalledWith('  ERROR  src/app.ts:0:0  Issue  [test/rule]');
    });
  });

  describe('onComplete', () => {
    it('prints a summary of error and warning counts', () => {
      const reporter = createConsoleReporter();
      const summary: RunSummary = {
        totalFiles: 10,
        totalRules: 5,
        violations: [],
        errorCount: 3,
        warnCount: 2,
        durationMs: 150.5,
      };

      reporter.onComplete(summary);

      expect(console.error).toHaveBeenCalledWith('');
      expect(console.error).toHaveBeenCalledWith('3 errors, 2 warnings (151ms)');
    });

    it('prints correctly when errors and warnings are both 0', () => {
      const reporter = createConsoleReporter();
      const summary: RunSummary = {
        totalFiles: 0,
        totalRules: 0,
        violations: [],
        errorCount: 0,
        warnCount: 0,
        durationMs: 0,
      };

      reporter.onComplete(summary);

      expect(console.error).toHaveBeenCalledWith('0 errors, 0 warnings (0ms)');
    });

    it('rounds fractional durationMs to an integer', () => {
      const reporter = createConsoleReporter();
      const summary: RunSummary = {
        totalFiles: 0,
        totalRules: 0,
        violations: [],
        errorCount: 0,
        warnCount: 0,
        durationMs: 99.7,
      };

      reporter.onComplete(summary);

      expect(console.error).toHaveBeenCalledWith('0 errors, 0 warnings (100ms)');
    });
  });
});

describe('createJsonReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('has name "json"', () => {
    const reporter = createJsonReporter();
    expect(reporter.name).toBe('json');
  });

  it('outputs violations and summary as JSON in onComplete', () => {
    const reporter = createJsonReporter();
    const violation: Violation = {
      ruleId: 'test/rule',
      message: 'Bad',
      severity: 'error',
    };

    reporter.onStart({ rootDir: '/root', ruleCount: 1 });
    reporter.onViolation(violation);
    reporter.onComplete({
      totalFiles: 1,
      totalRules: 1,
      violations: [violation],
      errorCount: 1,
      warnCount: 0,
      durationMs: 50,
    });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      violations: Violation[];
      summary: Record<string, unknown>;
    };

    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0].ruleId).toBe('test/rule');
    expect(parsed.summary).toStrictEqual({
      totalRules: 1,
      errorCount: 1,
      warnCount: 0,
      durationMs: 50,
    });
  });

  it('outputs an empty violations array when there are no violations', () => {
    const reporter = createJsonReporter();

    reporter.onComplete({
      totalFiles: 0,
      totalRules: 0,
      violations: [],
      errorCount: 0,
      warnCount: 0,
      durationMs: 0,
    });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { violations: unknown[] };

    expect(parsed.violations).toStrictEqual([]);
  });

  it('collects multiple violations in order', () => {
    const reporter = createJsonReporter();

    reporter.onViolation({ ruleId: 'a', message: 'First', severity: 'error' });
    reporter.onViolation({ ruleId: 'b', message: 'Second', severity: 'warn' });
    reporter.onViolation({ ruleId: 'c', message: 'Third', severity: 'error' });

    reporter.onComplete({
      totalFiles: 0,
      totalRules: 3,
      violations: [],
      errorCount: 2,
      warnCount: 1,
      durationMs: 10,
    });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { violations: Array<{ ruleId: string }> };

    expect(parsed.violations).toHaveLength(3);
    expect(parsed.violations.map((v) => v.ruleId)).toStrictEqual(['a', 'b', 'c']);
  });
});
