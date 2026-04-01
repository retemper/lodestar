import type { Reporter, Violation, RunSummary } from '@lodestar/types';

/** Create a console reporter that prints violations to stderr */
function createConsoleReporter(): Reporter {
  return {
    name: 'console',

    onStart({ ruleCount }) {
      console.error(`Running ${ruleCount} rules...\n`);
    },

    onViolation(violation: Violation) {
      const severity = violation.severity === 'error' ? 'ERROR' : 'WARN';
      const location = violation.location
        ? `${violation.location.file}:${violation.location.line ?? 0}:${violation.location.column ?? 0}`
        : '(project)';
      console.error(`  ${severity}  ${location}  ${violation.message}  [${violation.ruleId}]`);
    },

    onComplete(summary: RunSummary) {
      console.error('');
      console.error(
        `${summary.errorCount} errors, ${summary.warnCount} warnings (${summary.durationMs.toFixed(0)}ms)`,
      );
    },
  };
}

export { createConsoleReporter };
