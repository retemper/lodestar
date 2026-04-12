import type { Violation } from './rule';

/** Reporter formats and outputs rule execution progress and results */
interface Reporter {
  /** Unique reporter name (e.g., "console", "json", "sarif") */
  readonly name: string;
  /** Called once before any rules run, with the project root and total rule count */
  onStart(config: { rootDir: string; ruleCount: number }): void;
  /** Called before each rule begins execution */
  onRuleStart?(ruleId: string): void;
  /** Called after each rule finishes, with its individual result */
  onRuleComplete?(result: RuleResultSummary): void;
  /** Called each time a rule reports a violation */
  onViolation(violation: Violation): void;
  /** Called after all rules finish, with the aggregated run summary */
  onComplete(summary: RunSummary): void;
}

/** Extended reporter that understands workspace (monorepo) structure */
interface WorkspaceReporter extends Reporter {
  /** Called when starting a workspace package check */
  onPackageStart?(pkg: WorkspacePackageInfo): void;
  /** Called when a workspace package check completes */
  onPackageComplete?(pkg: WorkspacePackageInfo, summary: RunSummary): void;
}

/** Minimal package info passed to workspace reporter hooks */
interface WorkspacePackageInfo {
  /** Package name (from package.json or directory basename) */
  readonly name: string;
  /** Absolute path to the package directory */
  readonly dir: string;
}

/** Factory that creates a reporter instance */
interface ReporterFactory {
  /** Unique reporter identifier (e.g., "sarif", "junit") */
  readonly name: string;
  /** Create a WorkspaceReporter instance with optional configuration */
  create(options?: Readonly<Record<string, unknown>>): WorkspaceReporter;
}

/** Summary of a single rule's execution */
interface RuleResultSummary {
  /** Fully qualified rule identifier */
  readonly ruleId: string;
  /** Violations this rule found */
  readonly violations: readonly Violation[];
  /** Wall-clock time for this rule */
  readonly durationMs: number;
  /** Human-readable metadata from the rule (e.g., "14 files", "0 cycles") */
  readonly meta?: string;
  /** Documentation URL for the rule */
  readonly docsUrl?: string;
  /** Error if the rule threw */
  readonly error?: Error;
}

/** Summary of a lodestar check run */
interface RunSummary {
  /** Number of files scanned during the run */
  readonly totalFiles: number;
  /** Number of rules that were evaluated */
  readonly totalRules: number;
  /** All violations collected across every rule */
  readonly violations: readonly Violation[];
  /** Per-rule results for detailed reporting */
  readonly ruleResults: readonly RuleResultSummary[];
  /** Count of violations with severity "error" */
  readonly errorCount: number;
  /** Count of violations with severity "warn" */
  readonly warnCount: number;
  /** Wall-clock time for the entire check run, in milliseconds */
  readonly durationMs: number;
}

/** Reference to a reporter — built-in name, factory, or factory with options */
type ReporterEntry =
  | string
  | ReporterFactory
  | readonly [ReporterFactory, Readonly<Record<string, unknown>>];

export type {
  Reporter,
  WorkspaceReporter,
  WorkspacePackageInfo,
  ReporterFactory,
  ReporterEntry,
  RuleResultSummary,
  RunSummary,
};
