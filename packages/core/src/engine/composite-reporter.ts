import type {
  WorkspaceReporter,
  WorkspacePackageInfo,
  RunSummary,
  RuleResultSummary,
  Violation,
} from '@retemper/lodestar-types';

/**
 * Combine multiple reporters into one — each event is broadcast to all delegates.
 * @param reporters - reporters to fan-out events to
 */
function createCompositeReporter(reporters: readonly WorkspaceReporter[]): WorkspaceReporter {
  return {
    name: 'composite',

    onStart(config) {
      for (const r of reporters) r.onStart(config);
    },

    onRuleStart(ruleId: string) {
      for (const r of reporters) r.onRuleStart?.(ruleId);
    },

    onRuleComplete(result: RuleResultSummary) {
      for (const r of reporters) r.onRuleComplete?.(result);
    },

    onViolation(violation: Violation) {
      for (const r of reporters) r.onViolation(violation);
    },

    onComplete(summary: RunSummary) {
      for (const r of reporters) r.onComplete(summary);
    },

    onPackageStart(pkg: WorkspacePackageInfo) {
      for (const r of reporters) r.onPackageStart?.(pkg);
    },

    onPackageComplete(pkg: WorkspacePackageInfo, summary: RunSummary) {
      for (const r of reporters) r.onPackageComplete?.(pkg, summary);
    },
  };
}

export { createCompositeReporter };
