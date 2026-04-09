import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type {
  Logger,
  WrittenConfig,
  WrittenConfigBlock,
  WorkspaceReporter,
} from '@retemper/lodestar';
import {
  loadConfigFile,
  resolveConfig,
  createDiskCacheProvider,
  createLogger,
  createWatcher,
  createCompositeReporter,
} from '@retemper/lodestar';
import { createConsoleReporter } from '../reporters/console';
import { createJsonReporter } from '../reporters/json';

/** Options for the watch command */
interface WatchOptions {
  readonly format: string;
  readonly rule?: readonly string[];
  readonly fix?: boolean;
  readonly cache?: boolean;
  readonly debounce?: number;
}

/** Execute architecture rule checks in watch mode */
async function watchCommand(args: ArgumentsCamelCase<WatchOptions>): Promise<void> {
  const logger = createLogger();
  const rootDir = resolve(process.cwd());

  const writtenConfig = await loadConfigFile(rootDir);
  if (!writtenConfig) {
    logger.error(`No lodestar.config.ts found in ${rootDir}`);
    process.exitCode = 1;
    return;
  }

  const effectiveConfig = args.rule ? filterRules(writtenConfig, args.rule) : writtenConfig;
  const resolved = resolveConfig(effectiveConfig, rootDir);

  const cacheProvider = args.cache !== false ? createDiskCacheProvider(rootDir) : undefined;
  const reporter = buildReporter(args.format, resolved.reporters, logger);

  logger.info(`Watching ${rootDir} for changes...\n`);

  const handle = createWatcher({
    config: resolved,
    reporter,
    fix: args.fix,
    cache: cacheProvider,
    debounceMs: args.debounce,
    logger,
    onCycle(summary) {
      logger.info(
        `\nWatch: ${summary.changedFiles.length} changed → ${summary.scopeSize} in scope | ` +
          `${summary.errorCount} errors, ${summary.warnCount} warnings (${summary.durationMs.toFixed(0)}ms)`,
      );
      if (summary.changedFiles.length <= 5) {
        logger.info(`  Files: ${summary.changedFiles.join(', ')}`);
      }
    },
  });

  // Handle graceful shutdown
  const cleanup = () => {
    logger.info('\nStopping watcher...');
    handle.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process alive
  await new Promise(() => {});
}

/** Build the reporter to use */
function buildReporter(
  format: string,
  configReporters: readonly WorkspaceReporter[],
  logger: Logger,
): WorkspaceReporter {
  const cliReporter = format === 'json' ? createJsonReporter() : createConsoleReporter({ logger });

  if (configReporters.length === 0) {
    return cliReporter;
  }

  return createCompositeReporter([cliReporter, ...configReporters]);
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

/** Check if a rule ID matches any filter pattern */
function matchesRuleFilter(ruleId: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === ruleId) return true;
    if (pattern.endsWith('/*') && ruleId.startsWith(pattern.slice(0, -1))) return true;
  }
  return false;
}

export { watchCommand };
export type { WatchOptions };
