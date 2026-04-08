import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';
import { tryResolve } from './relative';

/** A single tsconfig paths mapping pattern */
interface PathMapping {
  /** Pattern prefix before the wildcard (e.g., '@app/') */
  readonly prefix: string;
  /** Pattern suffix after the wildcard (empty string if no wildcard) */
  readonly suffix: string;
  /** Replacement targets (first match wins) */
  readonly targets: readonly PathTarget[];
  /** Whether this pattern contains a wildcard */
  readonly hasWildcard: boolean;
}

/** A single replacement target within a paths mapping */
interface PathTarget {
  /** Target prefix before the wildcard */
  readonly prefix: string;
  /** Target suffix after the wildcard */
  readonly suffix: string;
}

/** Parsed tsconfig paths configuration */
interface TsconfigPaths {
  /** Base URL for non-relative module names (absolute path) */
  readonly baseUrl: string;
  /** Compiled path mappings */
  readonly mappings: readonly PathMapping[];
}

/** Options for the tsconfig paths resolver */
interface TsconfigPathsResolverOptions {
  /** Absolute path to tsconfig.json (auto-detected from rootDir if omitted) */
  readonly tsconfigPath?: string;
}

/**
 * Parse a tsconfig.json file and extract paths configuration.
 * Handles "extends" by recursively merging parent configs.
 * @param tsconfigPath - absolute path to tsconfig.json
 * @param visited - set of visited paths to prevent circular extends
 */
async function parseTsconfigPaths(
  tsconfigPath: string,
  visited: ReadonlySet<string> = new Set(),
): Promise<TsconfigPaths | null> {
  if (visited.has(tsconfigPath)) return null;
  if (visited.size >= 10) return null;

  const nextVisited = new Set([...visited, tsconfigPath]);
  const tsconfigDir = dirname(tsconfigPath);

  const raw = await readFile(tsconfigPath, 'utf-8').catch(() => null);
  if (!raw) return null;

  const config = JSON.parse(stripJsonComments(raw)) as {
    extends?: string;
    compilerOptions?: { baseUrl?: string; paths?: Record<string, readonly string[]> };
  };

  const parentPaths = config.extends
    ? await parseTsconfigPaths(resolve(tsconfigDir, config.extends), nextVisited)
    : null;

  const compilerOptions = config.compilerOptions;
  const rawPaths = compilerOptions?.paths;
  if (!rawPaths && !parentPaths) return null;

  const baseUrl = compilerOptions?.baseUrl
    ? resolve(tsconfigDir, compilerOptions.baseUrl)
    : (parentPaths?.baseUrl ?? tsconfigDir);

  const mergedRawPaths: Record<string, readonly string[]> = {};
  if (parentPaths) {
    for (const m of parentPaths.mappings) {
      const pattern = m.hasWildcard ? `${m.prefix}*${m.suffix}` : m.prefix;
      mergedRawPaths[pattern] = m.targets.map((t) =>
        m.hasWildcard ? `${t.prefix}*${t.suffix}` : t.prefix,
      );
    }
  }
  if (rawPaths) {
    for (const [key, value] of Object.entries(rawPaths)) {
      mergedRawPaths[key] = value;
    }
  }

  const mappings = compileMappings(mergedRawPaths);
  return { baseUrl, mappings };
}

/** Compile raw paths config into optimized matching structures */
function compileMappings(rawPaths: Record<string, readonly string[]>): readonly PathMapping[] {
  const mappings: PathMapping[] = [];

  for (const [pattern, targets] of Object.entries(rawPaths)) {
    const starIdx = pattern.indexOf('*');
    const hasWildcard = starIdx >= 0;

    const compiled: PathMapping = {
      prefix: hasWildcard ? pattern.slice(0, starIdx) : pattern,
      suffix: hasWildcard ? pattern.slice(starIdx + 1) : '',
      hasWildcard,
      targets: targets.map((t) => {
        const tStar = t.indexOf('*');
        return tStar >= 0
          ? { prefix: t.slice(0, tStar), suffix: t.slice(tStar + 1) }
          : { prefix: t, suffix: '' };
      }),
    };

    mappings.push(compiled);
  }

  return mappings;
}

/**
 * Match an import source against a path mapping pattern.
 * @returns the wildcard-captured part, or null if no match
 */
function matchPattern(source: string, mapping: PathMapping): string | null {
  if (mapping.hasWildcard) {
    if (!source.startsWith(mapping.prefix)) return null;
    if (mapping.suffix && !source.endsWith(mapping.suffix)) return null;
    return source.slice(mapping.prefix.length, source.length - (mapping.suffix.length || 0));
  }
  return source === mapping.prefix ? '' : null;
}

/** Strip single-line and multi-line comments from JSON (for tsconfig with comments) */
function stripJsonComments(json: string): string {
  return json.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Convert an absolute resolved path to a root-relative path.
 * @param absPath - absolute file path
 * @param rootDir - absolute project root
 */
function toRootRelative(absPath: string, rootDir: string): string {
  const normalized = absPath.replaceAll('\\', '/');
  const normalizedRoot = rootDir.replaceAll('\\', '/').replace(/\/$/, '') + '/';
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.slice(normalizedRoot.length);
  }
  return normalized;
}

/** Create a resolver that handles tsconfig.json compilerOptions.paths aliases */
function createTsconfigPathsResolver(
  rootDir: string,
  options?: TsconfigPathsResolverOptions,
): ModuleResolver {
  const cache: { value: TsconfigPaths | null | undefined } = { value: undefined };

  async function loadPaths(): Promise<TsconfigPaths | null> {
    if (cache.value !== undefined) return cache.value;
    const tsconfigPath = options?.tsconfigPath ?? join(rootDir, 'tsconfig.json');
    cache.value = await parseTsconfigPaths(tsconfigPath);
    return cache.value;
  }

  return {
    resolve(ctx: ResolveContext): string | null {
      if (ctx.source.startsWith('.') || ctx.source.startsWith('/')) return null;

      /* Synchronous check — paths must be loaded before graph building starts.
         The graph provider calls loadPaths() once before iteration. */
      const paths = cache.value;
      if (!paths) return null;

      for (const mapping of paths.mappings) {
        const captured = matchPattern(ctx.source, mapping);
        if (captured === null) continue;

        for (const target of mapping.targets) {
          const targetPath = mapping.hasWildcard
            ? `${target.prefix}${captured}${target.suffix}`
            : target.prefix;

          const absTarget = resolve(paths.baseUrl, targetPath);
          const rootRelative = toRootRelative(absTarget, rootDir);
          const resolved = tryResolve(rootRelative, ctx.knownFiles);
          if (resolved) return resolved;
        }
      }

      return null;
    },
    /** Eagerly load tsconfig paths — call before graph iteration */
    loadPaths,
  } as ModuleResolver & { loadPaths: () => Promise<TsconfigPaths | null> };
}

export {
  createTsconfigPathsResolver,
  parseTsconfigPaths,
  compileMappings,
  matchPattern,
  stripJsonComments,
};
export type { TsconfigPathsResolverOptions, TsconfigPaths, PathMapping, PathTarget };
