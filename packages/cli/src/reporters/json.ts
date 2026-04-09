import type {
  WorkspaceReporter,
  WorkspacePackageInfo,
  Violation,
  RunSummary,
} from '@retemper/lodestar';

/** Create a JSON reporter that outputs structured results to stdout */
function createJsonReporter(): WorkspaceReporter {
  const violations: Violation[] = [];

  return {
    name: 'json',
    /** No-op — JSON output is deferred to onComplete */
    onStart() {},
    /** Collect each violation for later serialization */
    onViolation(violation: Violation) {
      violations.push(violation);
    },
    /** Serialize all collected violations and the summary to stdout as JSON */
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
    /** No-op — package boundaries not relevant for JSON output */
    onPackageStart(_pkg: WorkspacePackageInfo) {},
    /** No-op */
    onPackageComplete(_pkg: WorkspacePackageInfo, _summary: RunSummary) {},
  };
}

export { createJsonReporter };
