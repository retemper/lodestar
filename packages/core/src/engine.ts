import type {
  ResolvedConfig,
  Violation,
  RunSummary,
  Reporter,
  RuleProviders,
} from '@lodestar/types';
import { createFileSystemProvider } from './providers/fs.js';
import { createGraphProvider } from './providers/graph.js';
import { createASTProvider } from './providers/ast.js';
import { createConfigFileProvider } from './providers/config-file.js';
import { resolvePlugins } from './resolver.js';
import { runRules } from './runner.js';
import type { RuleResult } from './runner.js';

/** Options for engine.run() */
interface RunOptions {
  readonly config: ResolvedConfig;
  readonly reporter?: Reporter;
}

/** Create providers for the given root directory */
function createProviders(rootDir: string): RuleProviders {
  return {
    fs: createFileSystemProvider(rootDir),
    graph: createGraphProvider(rootDir),
    ast: createASTProvider(rootDir),
    config: createConfigFileProvider(rootDir),
  };
}

/** Run all rules against the project */
async function run(options: RunOptions): Promise<RunSummary> {
  const { config, reporter } = options;
  const startTime = performance.now();

  const providers = createProviders(config.rootDir);

  const resolvedRules = await resolvePlugins(config.plugins, config.rootDir);

  const activeRules = resolvedRules
    .map(({ rule }) => {
      const ruleConfig = config.rules.get(rule.name);
      if (!ruleConfig || ruleConfig.severity === 'off') return null;
      return { rule, config: ruleConfig };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  reporter?.onStart({
    rootDir: config.rootDir,
    ruleCount: activeRules.length,
  });

  const results = await runRules(activeRules, providers, config.rootDir);

  const violations = collectViolations(results);

  for (const violation of violations) {
    reporter?.onViolation(violation);
  }

  const summary: RunSummary = {
    totalFiles: 0,
    totalRules: activeRules.length,
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warnCount: violations.filter((v) => v.severity === 'warn').length,
    durationMs: performance.now() - startTime,
  };

  reporter?.onComplete(summary);

  return summary;
}

/** Collect all violations from rule results */
function collectViolations(results: readonly RuleResult[]): readonly Violation[] {
  return results.flatMap((r) => r.violations);
}

export { run, createProviders };
export type { RunOptions };
