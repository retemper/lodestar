import { dirname, join } from 'node:path';
import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';

/** File extensions to try when resolving imports */
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Convert OS-specific path separators to forward slashes */
function toForwardSlash(p: string): string {
  return p.replaceAll('\\', '/');
}

/** Normalize path segments — resolve . and .. */
function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const segment of p.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    if (segment) parts.push(segment);
  }
  return parts.join('/');
}

/**
 * Try to resolve a base path against known files with extension and index fallbacks.
 * @param base - normalized root-relative base path (no extension)
 * @param knownFiles - set of all known project file paths
 */
function tryResolve(base: string, knownFiles: ReadonlySet<string>): string | null {
  if (knownFiles.has(base)) return base;

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}/index${ext}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}

/** Resolve relative imports (./foo, ../bar, /abs) to actual file paths */
function createRelativeResolver(): ModuleResolver {
  return {
    resolve(ctx: ResolveContext): string | null {
      if (!ctx.source.startsWith('.') && !ctx.source.startsWith('/')) return null;

      const importerDir = dirname(ctx.importer);
      const base = normalizePath(toForwardSlash(join(importerDir, ctx.source)));
      return tryResolve(base, ctx.knownFiles);
    },
  };
}

export { createRelativeResolver, normalizePath, tryResolve };
