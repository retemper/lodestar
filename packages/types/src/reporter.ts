import type { Violation } from './rule.js';

/** Reporter formats and outputs violations */
interface Reporter {
  readonly name: string;
  onStart(config: { rootDir: string; ruleCount: number }): void;
  onViolation(violation: Violation): void;
  onComplete(summary: RunSummary): void;
}

/** Summary of a lodestar check run */
interface RunSummary {
  readonly totalFiles: number;
  readonly totalRules: number;
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly durationMs: number;
}

export type { Reporter, RunSummary };
