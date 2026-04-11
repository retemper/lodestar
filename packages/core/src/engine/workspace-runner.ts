import type { WrittenConfig, WorkspaceReporter, RunSummary } from '@retemper/lodestar-types';
import type { WorkspacePackage } from '@retemper/lodestar-config';
import { discoverWorkspaces, loadConfigFile, resolveConfig } from '@retemper/lodestar-config';
import { run } from './engine';
import type { CacheProvider } from '../utils/cache';

/** Default number of packages to run concurrently */
const DEFAULT_CONCURRENCY = 4;

/** Options for workspace-aware execution */
interface WorkspaceRunOptions {
  /** Root directory of the monorepo */
  readonly rootDir: string;
  /** Root config (already loaded) */
  readonly rootConfig: WrittenConfig;
  /** Optional reporter for output */
  readonly reporter?: WorkspaceReporter;
  /** When true, apply auto-fixes for fixable violations */
  readonly fix?: boolean;
  /** Disk cache provider shared across packages */
  readonly cache?: CacheProvider;
  /** Max packages to run in parallel (default: 4, use 1 for sequential) */
  readonly concurrency?: number;
  /** Optional transform applied to each sub-package config before execution */
  readonly configTransform?: (config: WrittenConfig) => WrittenConfig;
}

/** Summary for the entire workspace run */
interface WorkspaceSummary {
  /** Results from running rules against the monorepo root */
  readonly rootSummary: RunSummary;
  /** Per-package results */
  readonly packages: readonly PackageSummary[];
  /** Combined error count */
  readonly totalErrorCount: number;
  /** Combined warning count */
  readonly totalWarnCount: number;
  /** Wall-clock time for the entire workspace run */
  readonly totalDurationMs: number;
}

/** Summary for a single package within a workspace */
interface PackageSummary {
  /** The workspace package this summary belongs to */
  readonly package: WorkspacePackage;
  /** Rule execution results for the package */
  readonly summary: RunSummary;
}

/**
 * Run checks in workspace mode.
 * 1. Run root config against rootDir (always first, sequential)
 * 2. For each package with its own config, run with concurrency control
 */
async function runWorkspace(options: WorkspaceRunOptions): Promise<WorkspaceSummary> {
  const { rootDir, rootConfig, reporter, fix, cache, configTransform } = options;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const startTime = performance.now();

  // Root always runs first, sequentially
  const rootPkg: WorkspacePackage = { name: '(root)', dir: rootDir };
  reporter?.onPackageStart?.(rootPkg);

  const rootResolved = resolveConfig(rootConfig, rootDir);
  const rootSummary = await run({ config: rootResolved, reporter, fix, cache });
  reporter?.onPackageComplete?.(rootPkg, rootSummary);

  const packages = await discoverWorkspaces(rootDir);

  // Load configs and filter packages that have one
  const packagesWithConfig = await filterPackagesWithConfig(packages);

  // Run packages with concurrency control
  const packageSummaries = await runPackagesParallel(
    packagesWithConfig,
    { reporter, fix, cache, configTransform },
    concurrency,
  );

  const pkgErrors = packageSummaries.reduce((sum, p) => sum + p.summary.errorCount, 0);
  const pkgWarns = packageSummaries.reduce((sum, p) => sum + p.summary.warnCount, 0);

  return {
    rootSummary,
    packages: packageSummaries,
    totalErrorCount: rootSummary.errorCount + pkgErrors,
    totalWarnCount: rootSummary.warnCount + pkgWarns,
    totalDurationMs: performance.now() - startTime,
  };
}

/** Load config for each package and return only those with a config file */
async function filterPackagesWithConfig(
  packages: readonly WorkspacePackage[],
): Promise<readonly { pkg: WorkspacePackage; config: WrittenConfig }[]> {
  const results: { pkg: WorkspacePackage; config: WrittenConfig }[] = [];
  for (const pkg of packages) {
    const config = await loadConfigFile(pkg.dir);
    if (config) {
      results.push({ pkg, config });
    }
  }
  return results;
}

/** Run packages in parallel with a concurrency limit, emitting reporter events in order */
async function runPackagesParallel(
  packagesWithConfig: readonly { pkg: WorkspacePackage; config: WrittenConfig }[],
  context: {
    reporter?: WorkspaceReporter;
    fix?: boolean;
    cache?: CacheProvider;
    configTransform?: (config: WrittenConfig) => WrittenConfig;
  },
  concurrency: number,
): Promise<readonly PackageSummary[]> {
  const { reporter, fix, cache, configTransform } = context;

  if (packagesWithConfig.length === 0) return [];

  // Pre-allocate result slots to preserve input order
  const results: (PackageSummary | null)[] = new Array(packagesWithConfig.length).fill(null);
  const reporterEmitted = new Array<boolean>(packagesWithConfig.length).fill(false);

  // Track the next index whose reporter events should be emitted
  const state = { nextToEmit: 0 };

  const executePackage = async (index: number): Promise<void> => {
    const { pkg, config: rawConfig } = packagesWithConfig[index];
    const config = configTransform ? configTransform(rawConfig) : rawConfig;
    const resolved = resolveConfig(config, pkg.dir);
    const summary = await run({ config: resolved, fix, cache });
    results[index] = { package: pkg, summary };

    // Emit reporter events in order — flush all consecutive completed results
    flushReporterEvents(results, reporterEmitted, packagesWithConfig, state, reporter);
  };

  await pLimit(
    packagesWithConfig.map((_, i) => () => executePackage(i)),
    concurrency,
  );

  return results.filter((r): r is PackageSummary => r !== null);
}

/** Emit reporter events for completed packages in sequential order */
function flushReporterEvents(
  results: readonly (PackageSummary | null)[],
  emitted: boolean[],
  packagesWithConfig: readonly { pkg: WorkspacePackage; config: WrittenConfig }[],
  state: { nextToEmit: number },
  reporter?: WorkspaceReporter,
): void {
  while (state.nextToEmit < results.length) {
    const result = results[state.nextToEmit];
    if (!result || emitted[state.nextToEmit]) break;

    reporter?.onPackageStart?.(packagesWithConfig[state.nextToEmit].pkg);
    reporter?.onPackageComplete?.(result.package, result.summary);
    emitted[state.nextToEmit] = true;
    state.nextToEmit++;
  }
}

/** Run async tasks with a concurrency limit */
async function pLimit(tasks: readonly (() => Promise<void>)[], concurrency: number): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const promise = task().then(() => {
      executing.delete(promise);
    });
    executing.add(promise);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

export { runWorkspace };
export type { WorkspaceRunOptions, WorkspaceSummary, PackageSummary };
