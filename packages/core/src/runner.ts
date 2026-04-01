import type {
  RuleDefinition,
  RuleContext,
  RuleProviders,
  Violation,
  ResolvedRuleConfig,
} from '@lodestar/types';

/** Result of running a single rule */
interface RuleResult {
  readonly ruleId: string;
  readonly violations: readonly Violation[];
  readonly durationMs: number;
  readonly error?: Error;
}

/** Run a single rule and collect violations */
async function runRule(
  rule: RuleDefinition,
  ruleConfig: ResolvedRuleConfig,
  providers: RuleProviders,
  rootDir: string,
): Promise<RuleResult> {
  const violations: Violation[] = [];
  const startTime = performance.now();

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
  };

  try {
    await rule.check(ctx);
  } catch (error) {
    return {
      ruleId: rule.name,
      violations,
      durationMs: performance.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  return {
    ruleId: rule.name,
    violations,
    durationMs: performance.now() - startTime,
  };
}

/** Run multiple rules in parallel */
async function runRules(
  rules: ReadonlyArray<{ rule: RuleDefinition; config: ResolvedRuleConfig }>,
  providers: RuleProviders,
  rootDir: string,
): Promise<readonly RuleResult[]> {
  const results = await Promise.allSettled(
    rules.map(({ rule, config }) => runRule(rule, config, providers, rootDir)),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      ruleId: rules[index].rule.name,
      violations: [],
      durationMs: 0,
      error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
    };
  });
}

export { runRule, runRules };
export type { RuleResult };
