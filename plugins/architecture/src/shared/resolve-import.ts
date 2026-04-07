import { join, dirname } from 'node:path';

/** File extensions to try when resolving bare imports */
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Resolve a relative import source to an actual file path.
 * Self-contained — no dependency on @lodestar/core.
 * @param importer - relative path of the importing file
 * @param source - import specifier (e.g., './utils')
 * @param knownFiles - set of all known file paths for existence checks
 */
function resolveImport(importer: string, source: string, knownFiles: Set<string>): string | null {
  if (!source.startsWith('.') && !source.startsWith('/')) return null;

  const importerDir = dirname(importer);
  const base = normalizePath(join(importerDir, source).replaceAll('\\', '/'));

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

/** Normalize path segments (resolve . and ..) */
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

export { resolveImport, normalizePath };
