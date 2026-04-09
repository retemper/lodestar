import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';

/**
 * Resolve bare specifiers (e.g., 'lodash', '@scope/pkg') to node_modules entry points.
 * Only resolves packages that are actually imported — no full node_modules scan.
 * @param rootDir - absolute path to the project root
 */
function createNodeModulesResolver(_rootDir: string): ModuleResolver {
  const cache = new Map<string, string | null>();

  return {
    resolve(ctx: ResolveContext): string | null {
      if (ctx.source.startsWith('.') || ctx.source.startsWith('/')) return null;

      const packageName = extractPackageName(ctx.source);
      if (!packageName) return null;

      const cached = cache.get(ctx.source);
      if (cached !== undefined) return cached;

      const result = `node_modules/${ctx.source}`;
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

export { createNodeModulesResolver, extractPackageName };
