import type {
  Violation,
  RunSummary,
  RuleResultSummary,
  WorkspaceReporter,
  WorkspacePackage,
} from 'lodestar';

/** ANSI color codes */
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** Create a console reporter that shows per-rule progress with metadata */
function createConsoleReporter(): WorkspaceReporter {
  return {
    name: 'console',

    onStart() {},
    onRuleStart() {},

    /** Show pass/fail status per rule with meta and duration */
    onRuleComplete(result: RuleResultSummary) {
      const duration = `${DIM}${result.durationMs.toFixed(0)}ms${RESET}`;
      const meta = result.meta ? `${DIM}${result.meta}${RESET}` : '';
      const suffix = [meta, duration].filter(Boolean).join('  ');

      if (result.error) {
        console.error(`  ${RED}✗${RESET} ${result.ruleId}  ${RED}${result.error.message}${RESET}`);
        return;
      }

      const errorCount = result.violations.filter((v) => v.severity === 'error').length;
      const warnCount = result.violations.filter((v) => v.severity === 'warn').length;

      if (errorCount > 0) {
        console.error(`  ${RED}✗${RESET} ${result.ruleId}  ${suffix}`);
        for (const v of result.violations) {
          console.error(`    ${v.message} ${formatLocation(v)}`);
        }
        if (result.docsUrl) {
          console.error(`    ${DIM}docs: ${result.docsUrl}${RESET}`);
        }
      } else if (warnCount > 0) {
        console.error(`  ${YELLOW}!${RESET} ${result.ruleId}  ${suffix}`);
        for (const v of result.violations) {
          console.error(`    ${v.message} ${formatLocation(v)}`);
        }
        if (result.docsUrl) {
          console.error(`    ${DIM}docs: ${result.docsUrl}${RESET}`);
        }
      } else {
        console.error(`  ${GREEN}✓${RESET} ${result.ruleId}  ${suffix}`);
      }
    },

    onViolation() {},

    /** Print summary totals */
    onComplete(summary: RunSummary) {
      const passed = summary.ruleResults
        ? summary.ruleResults.filter((r) => r.violations.length === 0).length
        : summary.totalRules - (summary.errorCount > 0 ? 1 : 0);

      console.error(
        `  ${passed} rules passed, ${summary.errorCount} errors, ${summary.warnCount} warnings ${DIM}(${summary.durationMs.toFixed(0)}ms)${RESET}`,
      );
    },

    /** Print package header */
    onPackageStart(pkg: WorkspacePackage) {
      console.error(`\n${pkg.name}`);
    },

    onPackageComplete() {},
  };
}

/** Format a violation's location for display */
function formatLocation(v: Violation): string {
  if (!v.location) return '';
  const line = v.location.line ? `:${v.location.line}` : '';
  return `${DIM}at ${v.location.file}${line}${RESET}`;
}

export { createConsoleReporter };
