import type {
  RuleDefinition,
  RuleContext,
  RuleProviders,
  Violation,
  ResolvedRuleConfig,
} from '@retemper/lodestar-types';

/** Result of running a single rule */
interface RuleResult {
  /** Fully qualified identifier of the rule that produced this result */
  readonly ruleId: string;
  /** Violations detected by the rule */
  readonly violations: readonly Violation[];
  /** Wall-clock time the rule took to execute */
  readonly durationMs: number;
  /** Human-readable metadata from the rule (e.g., "14 files", "0 cycles") */
  readonly meta?: string;
  /** Captured error if the rule threw during execution */
  readonly error?: Error;
}

/**
 * Run a single rule and collect violations.
 * @param rule - rule definition containing the check function
 * @param ruleConfig - resolved severity and options for this rule
 * @param providers - data providers available to the rule
 * @param rootDir - absolute path to the project root
 */
async function runRule(
  rule: RuleDefinition,
  ruleConfig: ResolvedRuleConfig,
  providers: RuleProviders,
  rootDir: string,
): Promise<RuleResult> {
  const violations: Violation[] = [];
  const startTime = performance.now();
  let metaSummary: string | undefined;

  const ctx: RuleContext = {
    rootDir,
    options: ruleConfig.options,
    providers,
    report(partial) {
      const severity = ruleConfig.severity;
      if (severity === 'off') return;
      violations.push({
        ruleId: rule.name,
        message: partial.message,
        location: partial.location,
        severity,
        fix: partial.fix,
      });
    },
    meta(summary: string) {
      metaSummary = summary;
    },
  };

  try {
    await rule.check(ctx);
  } catch (error) {
    return {
      ruleId: rule.name,
      violations,
      durationMs: performance.now() - startTime,
      meta: metaSummary,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  return {
    ruleId: rule.name,
    violations,
    durationMs: performance.now() - startTime,
    meta: metaSummary,
  };
}

/**
 * Run multiple rules in parallel.
 * @param rules - pairs of rule definitions and their resolved configs
 * @param providers - shared data providers for all rules
 * @param rootDir - absolute path to the project root
 */
async function runRules(
  rules: ReadonlyArray<{ rule: RuleDefinition; config: ResolvedRuleConfig }>,
  providers: RuleProviders,
  rootDir: string,
): Promise<readonly RuleResult[]> {
  return Promise.all(rules.map(({ rule, config }) => runRule(rule, config, providers, rootDir)));
}

export { runRule, runRules };
export type { RuleResult };
