import type { WrittenConfig, Reporter, RunSummary } from '@lodestar/types';
import type { WorkspacePackage } from '@lodestar/config';
import { discoverWorkspaces, loadConfigFile, resolveConfig } from '@lodestar/config';
import { run } from './engine';

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
}

/** Extended reporter that understands workspace structure */
interface WorkspaceReporter extends Reporter {
  /** Called when starting a workspace package check */
  onPackageStart?(pkg: WorkspacePackage): void;
  /** Called when a workspace package check completes */
  onPackageComplete?(pkg: WorkspacePackage, summary: RunSummary): void;
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
 * 1. Run root config against rootDir
 * 2. For each package with its own config, run independently (no merge — flat config)
 */
async function runWorkspace(options: WorkspaceRunOptions): Promise<WorkspaceSummary> {
  const { rootDir, rootConfig, reporter, fix } = options;
  const startTime = performance.now();

  const rootPkg: WorkspacePackage = { name: '(root)', dir: rootDir };
  reporter?.onPackageStart?.(rootPkg);

  const rootResolved = resolveConfig(rootConfig, rootDir);
  const rootSummary = await run({ config: rootResolved, reporter, fix });
  reporter?.onPackageComplete?.(rootPkg, rootSummary);

  const packages = await discoverWorkspaces(rootDir);
  const packageSummaries: PackageSummary[] = [];

  for (const pkg of packages) {
    const packageConfig = await loadConfigFile(pkg.dir);
    if (!packageConfig) continue;

    reporter?.onPackageStart?.(pkg);
    const resolved = resolveConfig(packageConfig, pkg.dir);
    const summary = await run({ config: resolved, reporter, fix });

    packageSummaries.push({ package: pkg, summary });
    reporter?.onPackageComplete?.(pkg, summary);
  }

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

export { runWorkspace };
export type { WorkspaceRunOptions, WorkspaceReporter, WorkspaceSummary, PackageSummary };
