import type {
  Violation,
  RunSummary,
  RuleResultSummary,
  WorkspaceReporter,
  WorkspacePackageInfo,
  Logger,
} from '@retemper/lodestar';

/** ANSI color codes */
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** Options for the console reporter */
interface ConsoleReporterOptions {
  /** Logger to write output through (default: stderr logger) */
  readonly logger?: Logger;
}

/** Create a console reporter that shows per-rule progress with metadata */
function createConsoleReporter(options?: ConsoleReporterOptions): WorkspaceReporter {
  const log = options?.logger ?? createStderrLogger();

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
        log.error(`  ${RED}✗${RESET} ${result.ruleId}  ${RED}${result.error.message}${RESET}`);
        return;
      }

      const errorCount = result.violations.filter((v) => v.severity === 'error').length;
      const warnCount = result.violations.filter((v) => v.severity === 'warn').length;

      if (errorCount > 0) {
        log.error(`  ${RED}✗${RESET} ${result.ruleId}  ${suffix}`);
        for (const v of result.violations) {
          log.error(`    ${v.message} ${formatLocation(v)}`);
        }
        if (result.docsUrl) {
          log.info(`    ${DIM}docs: ${result.docsUrl}${RESET}`);
        }
      } else if (warnCount > 0) {
        log.warn(`  ${YELLOW}!${RESET} ${result.ruleId}  ${suffix}`);
        for (const v of result.violations) {
          log.warn(`    ${v.message} ${formatLocation(v)}`);
        }
        if (result.docsUrl) {
          log.info(`    ${DIM}docs: ${result.docsUrl}${RESET}`);
        }
      } else {
        log.info(`  ${GREEN}✓${RESET} ${result.ruleId}  ${suffix}`);
      }
    },

    onViolation() {},

    /** Print summary totals */
    onComplete(summary: RunSummary) {
      const passed = summary.ruleResults
        ? summary.ruleResults.filter((r) => r.violations.length === 0).length
        : summary.totalRules - (summary.errorCount > 0 ? 1 : 0);

      log.info(
        `  ${passed} rules passed, ${summary.errorCount} errors, ${summary.warnCount} warnings ${DIM}(${summary.durationMs.toFixed(0)}ms)${RESET}`,
      );
    },

    /** Print package header */
    onPackageStart(pkg: WorkspacePackageInfo) {
      log.info(`\n${pkg.name}`);
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

/** Create a minimal logger that writes directly to stderr */
function createStderrLogger(): Logger {
  const write = (message: string) => process.stderr.write(message + '\n');
  return {
    debug: write,
    error: write,
    info: write,
    warn: write,
  };
}

export { createConsoleReporter };
export type { ConsoleReporterOptions };
