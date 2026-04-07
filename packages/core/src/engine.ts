import type {
  ResolvedConfig,
  Violation,
  RunSummary,
  Reporter,
  RuleProviders,
  ResolvedRuleConfig,
} from '@retemper/types';
import { createFileSystemProvider } from './providers/fs';
import { createGraphProvider } from './providers/graph';
import { createASTProvider } from './providers/ast';
import { createConfigFileProvider } from './providers/config-file';
import { resolvePlugins } from './resolver';
import { runRule } from './runner';
import { validateConfig } from './validate';
import type { RuleResult } from './runner';
import type { ResolvedRule } from './resolver';

/** Options for engine.run() */
interface RunOptions {
  /** Fully resolved configuration for this run */
  readonly config: ResolvedConfig;
  /** Lifecycle hooks for progress reporting and violation output */
  readonly reporter?: Reporter;
  /** When true, apply auto-fixes for violations that support it */
  readonly fix?: boolean;
}

/**
 * Create providers for the given root directory.
 * @param rootDir - absolute path used as the project root for all providers
 */
function createProviders(rootDir: string): RuleProviders {
  const fsProvider = createFileSystemProvider(rootDir);
  const astProvider = createASTProvider(rootDir);

  return {
    fs: fsProvider,
    graph: createGraphProvider(rootDir, astProvider, fsProvider),
    ast: astProvider,
    config: createConfigFileProvider(rootDir),
  };
}

/**
 * Run all rules against the project — global rules, scoped rules, and external adapters.
 */
async function run(options: RunOptions): Promise<RunSummary> {
  const { config, reporter } = options;
  const startTime = performance.now();

  const providers = createProviders(config.rootDir);
  const resolvedRules = await resolvePlugins(config.plugins, config.rootDir);

  const availableRuleIds = new Set(resolvedRules.map((r) => r.rule.name));
  const diagnostics = validateConfig(config, availableRuleIds);
  const errors = diagnostics.filter((d) => d.level === 'error');
  if (errors.length > 0) {
    const messages = errors.map((d) => `  - ${d.message}`).join('\n');
    throw new Error(`Config validation failed:\n${messages}`);
  }

  reporter?.onStart({
    rootDir: config.rootDir,
    ruleCount: 0,
  });

  // 1. Run global rules (blocks without `files`)
  const results: RuleResult[] = [];
  const globalActiveRules = filterActiveRules(resolvedRules, config.rules);

  for (const { rule, config: ruleConfig } of globalActiveRules) {
    reporter?.onRuleStart?.(rule.name);
    const result = await runRule(rule, ruleConfig, providers, config.rootDir);
    results.push(result);
    reporter?.onRuleComplete?.({
      ruleId: result.ruleId,
      violations: result.violations,
      durationMs: result.durationMs,
      meta: result.meta,
      docsUrl: rule.docs?.url,
      error: result.error,
    });
  }

  // 2. Run scoped rules (blocks with `files`)
  for (const scope of config.scopedRules) {
    const scopedActiveRules = filterActiveRules(resolvedRules, scope.rules);

    for (const { rule, config: ruleConfig } of scopedActiveRules) {
      reporter?.onRuleStart?.(rule.name);
      const result = await runRule(rule, ruleConfig, providers, config.rootDir);
      results.push(result);
      reporter?.onRuleComplete?.({
        ruleId: result.ruleId,
        violations: result.violations,
        durationMs: result.durationMs,
        meta: result.meta,
        docsUrl: rule.docs?.url,
        error: result.error,
      });
    }
  }

  // 3. Verify adapter setup — missing/drifted config files are errors
  let setupViolations: Violation[] = [];
  const setupFailedAdapters = new Set<string>();
  for (const adapter of config.adapters) {
    if (!adapter.verifySetup) continue;
    reporter?.onRuleStart?.(`${adapter.name}/setup`);
    const setupStart = performance.now();
    try {
      const violations = await adapter.verifySetup(config.rootDir);
      if (violations.length > 0) {
        setupViolations = [...setupViolations, ...violations];
        setupFailedAdapters.add(adapter.name);
      }
      reporter?.onRuleComplete?.({
        ruleId: `${adapter.name}/setup`,
        violations,
        durationMs: performance.now() - setupStart,
      });
    } catch (error) {
      setupFailedAdapters.add(adapter.name);
      reporter?.onRuleComplete?.({
        ruleId: `${adapter.name}/setup`,
        violations: [],
        durationMs: performance.now() - setupStart,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Apply setup fixes before running adapter checks (so tools can find their config)
  if (options.fix) {
    for (const violation of setupViolations) {
      if (violation.fix) {
        await violation.fix.apply();
      }
    }
    setupFailedAdapters.clear();
  }

  // 4. Run external adapters — skip adapters whose setup failed
  let adapterViolations: Violation[] = [];
  for (const adapter of config.adapters) {
    if (!adapter.check) continue;
    if (setupFailedAdapters.has(adapter.name)) continue;
    reporter?.onRuleStart?.(adapter.name);
    const adapterStart = performance.now();
    try {
      const include = config.rules.size > 0 ? ['**/*.ts', '**/*.tsx'] : ['**/*.ts', '**/*.tsx'];
      const violations = await adapter.check(config.rootDir, include);
      adapterViolations = [...adapterViolations, ...violations];
      reporter?.onRuleComplete?.({
        ruleId: adapter.name,
        violations,
        durationMs: performance.now() - adapterStart,
        meta: `${violations.length} issues`,
      });
    } catch (error) {
      reporter?.onRuleComplete?.({
        ruleId: adapter.name,
        violations: [],
        durationMs: performance.now() - adapterStart,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // 5. Apply fixes if --fix
  if (options.fix) {
    // Fix native rule violations
    for (const violation of collectViolations(results)) {
      if (violation.fix) {
        await violation.fix.apply();
      }
    }
    // Fix adapter violations
    for (const violation of adapterViolations) {
      if (violation.fix) {
        await violation.fix.apply();
      }
    }
    // Run adapter-level fix (e.g., eslint --fix, prettier --write)
    for (const adapter of config.adapters) {
      if (adapter.fix) {
        await adapter.fix(config.rootDir, ['**/*.ts', '**/*.tsx']);
      }
    }
  }

  // 6. Merge results
  const nativeViolations = collectViolations(results);
  const allViolations = [...setupViolations, ...nativeViolations, ...adapterViolations];

  for (const violation of allViolations) {
    reporter?.onViolation(violation);
  }

  const ruleResults = results.map((r) => ({
    ruleId: r.ruleId,
    violations: r.violations,
    durationMs: r.durationMs,
    meta: r.meta,
    error: r.error,
  }));

  const totalRuleCount =
    config.adapters.filter((a) => a.verifySetup).length +
    globalActiveRules.length +
    config.scopedRules.reduce(
      (sum, s) => sum + filterActiveRules(resolvedRules, s.rules).length,
      0,
    ) +
    config.adapters.filter((a) => a.check).length;

  const summary: RunSummary = {
    totalFiles: 0,
    totalRules: totalRuleCount,
    violations: allViolations,
    ruleResults,
    errorCount: allViolations.filter((v) => v.severity === 'error').length,
    warnCount: allViolations.filter((v) => v.severity === 'warn').length,
    durationMs: performance.now() - startTime,
  };

  reporter?.onComplete(summary);

  return summary;
}

/** Filter resolved rules to only those that are active (severity !== 'off') */
function filterActiveRules(
  resolvedRules: readonly ResolvedRule[],
  ruleConfigs: ReadonlyMap<string, ResolvedRuleConfig>,
) {
  return resolvedRules
    .map(({ rule }) => {
      const ruleConfig = ruleConfigs.get(rule.name);
      if (!ruleConfig || ruleConfig.severity === 'off') return null;
      return { rule, config: ruleConfig };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/** Collect all violations from rule results */
function collectViolations(results: readonly RuleResult[]): readonly Violation[] {
  return results.flatMap((r) => r.violations);
}

export { run, createProviders };
export type { RunOptions };
