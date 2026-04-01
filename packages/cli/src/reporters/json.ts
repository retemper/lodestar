import type { Reporter, Violation, RunSummary } from '@lodestar/types';

/** Create a JSON reporter that outputs structured results to stdout */
function createJsonReporter(): Reporter {
  const violations: Violation[] = [];

  return {
    name: 'json',
    onStart() {},
    onViolation(violation: Violation) {
      violations.push(violation);
    },
    onComplete(summary: RunSummary) {
      const output = {
        violations,
        summary: {
          totalRules: summary.totalRules,
          errorCount: summary.errorCount,
          warnCount: summary.warnCount,
          durationMs: summary.durationMs,
        },
      };
      process.stdout.write(JSON.stringify(output, null, 2));
    },
  };
}

export { createJsonReporter };
