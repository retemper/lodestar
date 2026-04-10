import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { Logger, WorkspaceReporter } from '@retemper/lodestar';
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
import { filterRules, filterAdapters } from '../filter';

/** Options for the watch command */
interface WatchOptions {
  readonly format: string;
  readonly rule?: readonly string[];
  readonly adapter?: readonly string[];
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

  let effectiveConfig = args.rule ? filterRules(writtenConfig, args.rule) : writtenConfig;
  effectiveConfig = args.adapter ? filterAdapters(effectiveConfig, args.adapter) : effectiveConfig;
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

export { watchCommand };
export type { WatchOptions };
