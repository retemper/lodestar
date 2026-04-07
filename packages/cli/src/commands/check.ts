import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { WrittenConfig, WrittenConfigBlock } from '@retemper/lodestar';
import { loadConfigFile, discoverWorkspaces, resolveConfig, run, runWorkspace } from '@retemper/lodestar';
import { createConsoleReporter } from '../reporters/console';
import { createJsonReporter } from '../reporters/json';

/** Options for the check command */
interface CheckOptions {
  readonly config?: string;
  readonly format: string;
  readonly workspace?: boolean;
  readonly rule?: readonly string[];
  readonly fix?: boolean;
}

/** Execute architecture rule checks */
async function checkCommand(args: ArgumentsCamelCase<CheckOptions>): Promise<void> {
  const rootDir = resolve(process.cwd());

  const writtenConfig = await loadConfigFile(rootDir);
  if (!writtenConfig) {
    console.error('No lodestar.config.ts found in', rootDir);
    process.exitCode = 1;
    return;
  }

  const effectiveConfig = args.rule ? filterRules(writtenConfig, args.rule) : writtenConfig;
  const reporter = args.format === 'json' ? createJsonReporter() : createConsoleReporter();
  const useWorkspace = await shouldUseWorkspaceMode(rootDir, args.workspace);

  if (useWorkspace) {
    const result = await runWorkspace({
      rootDir,
      rootConfig: effectiveConfig,
      reporter,
      fix: args.fix,
    });
    const packageCount = result.packages.length + 1;
    console.error(
      `\nTotal: ${result.totalErrorCount} errors, ${result.totalWarnCount} warnings across ${packageCount} packages (${result.totalDurationMs.toFixed(0)}ms)`,
    );
    if (result.totalErrorCount > 0) {
      process.exitCode = 1;
    }
  } else {
    const config = resolveConfig(effectiveConfig, rootDir);
    const summary = await run({ config, reporter, fix: args.fix });
    if (summary.errorCount > 0) {
      process.exitCode = 1;
    }
  }
}

/** Filter config blocks to only include specified rules */
function filterRules(config: WrittenConfig, ruleIds: readonly string[]): WrittenConfig {
  const blocks = Array.isArray(config) ? [...config] : [config];
  return blocks.map((block) => {
    if (!block.rules) return block;
    const filtered: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(block.rules)) {
      if (matchesRuleFilter(id, ruleIds)) {
        filtered[id] = value;
      }
    }
    return { ...block, rules: filtered as WrittenConfigBlock['rules'] };
  });
}

/** Check if a rule ID matches any filter pattern (exact or prefix/*) */
function matchesRuleFilter(ruleId: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === ruleId) return true;
    if (pattern.endsWith('/*') && ruleId.startsWith(pattern.slice(0, -1))) return true;
  }
  return false;
}

/** Determine if workspace mode should be used */
async function shouldUseWorkspaceMode(
  rootDir: string,
  explicitFlag: boolean | undefined,
): Promise<boolean> {
  if (explicitFlag === true) return true;
  if (explicitFlag === false) return false;
  const packages = await discoverWorkspaces(rootDir);
  return packages.length > 0;
}

export { checkCommand };
export type { CheckOptions };
