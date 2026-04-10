import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { Logger, WorkspaceReporter } from '@retemper/lodestar';
import {
  loadConfigFile,
  discoverWorkspaces,
  resolveConfig,
  run,
  runWorkspace,
  createCompositeReporter,
  createDiskCacheProvider,
  createLogger,
  getChangedFiles,
  computeImpactScope,
  createProviders,
} from '@retemper/lodestar';
import { createConsoleReporter } from '../reporters/console';
import { createJsonReporter } from '../reporters/json';
import { createSarifReporter } from '@retemper/lodestar-reporter-sarif';
import { createJunitReporter } from '@retemper/lodestar-reporter-junit';
import { filterRules, filterAdapters } from '../filter';

/** Options for the check command */
interface CheckOptions {
  readonly config?: string;
  readonly format: string;
  readonly workspace?: boolean;
  readonly rule?: readonly string[];
  readonly adapter?: readonly string[];
  readonly fix?: boolean;
  readonly cache?: boolean;
  readonly clearCache?: boolean;
  readonly changed?: string | boolean;
  readonly concurrency?: number;
}

/** Execute architecture rule checks */
async function checkCommand(args: ArgumentsCamelCase<CheckOptions>): Promise<void> {
  const logger = createLogger();
  const rootDir = resolve(process.cwd());

  const cacheProvider = args.cache !== false ? createDiskCacheProvider(rootDir) : undefined;

  if (args.clearCache && cacheProvider) {
    await cacheProvider.clear();
    logger.info('Cache cleared.');
  }

  const writtenConfig = await loadConfigFile(rootDir);
  if (!writtenConfig) {
    logger.error(`No lodestar.config.ts found in ${rootDir}`);
    process.exitCode = 1;
    return;
  }

  let effectiveConfig = args.rule ? filterRules(writtenConfig, args.rule) : writtenConfig;
  effectiveConfig = args.adapter ? filterAdapters(effectiveConfig, args.adapter) : effectiveConfig;
  const resolved = resolveConfig(effectiveConfig, rootDir);

  const reporter = buildReporter(args.format, resolved.reporters, logger);
  const useWorkspace = await shouldUseWorkspaceMode(rootDir, args.workspace);

  if (args.changed !== undefined) {
    const base = typeof args.changed === 'string' ? args.changed : undefined;
    const changedFiles = await getChangedFiles(rootDir, base);

    if (changedFiles.length === 0) {
      logger.info('No changed files detected.');
      return;
    }

    const providers = createProviders(rootDir, cacheProvider);
    const graph = await providers.graph.getModuleGraph();
    const scope = computeImpactScope(changedFiles, graph);

    logger.info(
      `Incremental: ${changedFiles.length} changed, ${scope.size} in scope${base ? ` (vs ${base})` : ''}`,
    );

    const summary = await run({
      config: resolved,
      reporter,
      fix: args.fix,
      cache: cacheProvider,
      scope,
    });
    if (summary.errorCount > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (useWorkspace) {
    const result = await runWorkspace({
      rootDir,
      rootConfig: effectiveConfig,
      reporter,
      fix: args.fix,
      cache: cacheProvider,
      concurrency: args.concurrency,
    });
    const packageCount = result.packages.length + 1;
    logger.info(
      `\nTotal: ${result.totalErrorCount} errors, ${result.totalWarnCount} warnings across ${packageCount} packages (${result.totalDurationMs.toFixed(0)}ms)`,
    );
    if (result.totalErrorCount > 0) {
      process.exitCode = 1;
    }
  } else {
    const summary = await run({ config: resolved, reporter, fix: args.fix, cache: cacheProvider });
    if (summary.errorCount > 0) {
      process.exitCode = 1;
    }
  }
}

/** Create a reporter matching the given format name */
function selectReporter(format: string, logger: Logger): WorkspaceReporter {
  switch (format) {
    case 'json':
      return createJsonReporter();
    case 'sarif':
      return createSarifReporter();
    case 'junit':
      return createJunitReporter();
    default:
      return createConsoleReporter({ logger });
  }
}

/**
 * Build the reporter to use.
 * Priority: CLI --format flag overrides config reporters; default is console.
 */
function buildReporter(
  format: string,
  configReporters: readonly WorkspaceReporter[],
  logger: Logger,
): WorkspaceReporter {
  const cliReporter = selectReporter(format, logger);

  if (configReporters.length === 0) {
    return cliReporter;
  }

  return createCompositeReporter([cliReporter, ...configReporters]);
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
