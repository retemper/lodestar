import { watch } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Logger, ResolvedConfig, Reporter } from '@retemper/lodestar-types';
import { createProviders, run } from './engine';
import { computeImpactScope } from './incremental';
import type { CacheProvider } from './cache';
import { silentLogger } from './logger';

/** Directories and patterns to ignore during file watching */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
];

/** Options for the file watcher */
interface WatchOptions {
  /** Fully resolved configuration for each run */
  readonly config: ResolvedConfig;
  /** Lifecycle reporter for progress and violations */
  readonly reporter?: Reporter;
  /** When true, apply auto-fixes on each run */
  readonly fix?: boolean;
  /** Disk cache provider shared across runs */
  readonly cache?: CacheProvider;
  /** Debounce interval in milliseconds (default: 300) */
  readonly debounceMs?: number;
  /** Additional directory names to ignore */
  readonly ignore?: readonly string[];
  /** Logger for diagnostic messages (default: silent) */
  readonly logger?: Logger;
  /** Callback invoked after each watch cycle completes */
  readonly onCycle?: (summary: WatchCycleSummary) => void;
}

/** Summary of a single watch cycle */
interface WatchCycleSummary {
  /** Files that triggered this cycle */
  readonly changedFiles: readonly string[];
  /** Total files in the impact scope */
  readonly scopeSize: number;
  /** Number of errors found */
  readonly errorCount: number;
  /** Number of warnings found */
  readonly warnCount: number;
  /** Duration of this cycle in milliseconds */
  readonly durationMs: number;
}

/** Handle returned by createWatcher for lifecycle control */
interface WatcherHandle {
  /** Stop the watcher and clean up resources */
  close(): void;
}

/**
 * Create a file watcher that re-runs affected rules when files change.
 * Uses Node.js recursive fs.watch with debouncing and impact scope analysis.
 */
function createWatcher(options: WatchOptions): WatcherHandle {
  const { config, reporter, fix, cache } = options;
  const debounceMs = options.debounceMs ?? 300;
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...(options.ignore ?? [])];
  const logger = options.logger ?? silentLogger;
  const rootDir = config.rootDir;

  const pendingFiles = new Set<string>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let closed = false;

  const fsWatcher = watch(rootDir, { recursive: true }, (_event, filename) => {
    if (closed || !filename) return;
    const normalized = filename.replaceAll('\\', '/');
    if (shouldIgnore(normalized, ignorePatterns)) return;

    pendingFiles.add(normalized);
    scheduleRun();
  });

  /** Schedule a debounced run */
  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void triggerRun();
    }, debounceMs);
  }

  /** Execute a rule check cycle for pending changed files */
  async function triggerRun(): Promise<void> {
    if (running || closed) return;
    running = true;

    const changedFiles = [...pendingFiles];
    pendingFiles.clear();

    try {
      const providers = createProviders(rootDir, cache);
      const graph = await providers.graph.getModuleGraph();

      // Resolve changed file paths relative to rootDir (normalize to forward slashes for cross-platform)
      const resolvedChanges = changedFiles.map((f) =>
        relative(rootDir, resolve(rootDir, f)).replaceAll('\\', '/'),
      );
      const scope = computeImpactScope(resolvedChanges, graph);

      const summary = await run({ config, reporter, fix, cache, scope });

      options.onCycle?.({
        changedFiles: resolvedChanges,
        scopeSize: scope.size,
        errorCount: summary.errorCount,
        warnCount: summary.warnCount,
        durationMs: summary.durationMs,
      });
    } catch (error) {
      // Emit error but don't crash the watcher
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Watch cycle error: ${message}`);
    } finally {
      running = false;

      // If files changed during the run, schedule another
      if (pendingFiles.size > 0 && !closed) {
        scheduleRun();
      }
    }
  }

  return {
    close() {
      closed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      fsWatcher.close();
    },
  };
}

/** Check if a file path matches any ignore pattern */
function shouldIgnore(filePath: string, patterns: readonly string[]): boolean {
  const segments = filePath.split(/[/\\]/);
  return segments.some((segment) => patterns.includes(segment));
}

export { createWatcher };
export type { WatchOptions, WatchCycleSummary, WatcherHandle };
