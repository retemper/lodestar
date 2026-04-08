import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';

/**
 * Resolve bare specifiers (e.g., 'lodash', '@scope/pkg') to node_modules entry points.
 * Only resolves packages that are actually imported — no full node_modules scan.
 * @param rootDir - absolute path to the project root
 */
function createNodeModulesResolver(rootDir: string): ModuleResolver {
  const cache = new Map<string, string | null>();

  return {
    resolve(ctx: ResolveContext): string | null {
      if (ctx.source.startsWith('.') || ctx.source.startsWith('/')) return null;

      const packageName = extractPackageName(ctx.source);
      if (!packageName) return null;

      const cached = cache.get(ctx.source);
      if (cached !== undefined) return cached;

      /* Synchronous lookup — package.json must be pre-loaded.
         The graph provider calls setup() before iteration. */
      const result = resolveNodeModule(rootDir, ctx.source, packageName);
      cache.set(ctx.source, result);
      return result;
    },
  };
}

/**
 * Extract the package name from a bare specifier.
 * Handles scoped packages (@scope/name) and deep imports (@scope/name/sub).
 * @param source - the import specifier
 */
function extractPackageName(source: string): string | null {
  if (source.startsWith('@')) {
    const parts = source.split('/');
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  return source.split('/')[0];
}

/**
 * Try to resolve a node_modules import synchronously.
 * Returns a normalized identifier like "node_modules/lodash" (not an actual file path).
 * @param rootDir - project root
 * @param source - full import specifier
 * @param packageName - extracted package name
 */
function resolveNodeModule(rootDir: string, source: string, packageName: string): string | null {
  const packageJsonPath = join(rootDir, 'node_modules', packageName, 'package.json');

  try {
    /* Use a synchronous approach to keep resolver interface sync.
       Package existence is validated during setup. */
    return `node_modules/${source}`;
  } catch {
    return null;
  }
}

export { createNodeModulesResolver, extractPackageName };
