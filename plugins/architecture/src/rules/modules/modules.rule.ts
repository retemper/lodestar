import { defineRule } from '@retemper/types';

/** Enforce module boundary encapsulation — external code must use the barrel (index) import */
const modules = defineRule<{
  /** Module root directories that enforce barrel-only imports */
  readonly modules: readonly string[];
  /** Import paths permitted even when deep (e.g., test utilities) */
  readonly allow?: readonly string[];
  /** Glob patterns for files to check — defaults to module source files */
  readonly include?: readonly string[];
  /** Glob patterns for files to skip (e.g., test files) */
  readonly exclude?: readonly string[];
}>({
  name: 'architecture/modules',
  description:
    'Forbids importing internal files of a module, requiring barrel (index) imports. Supports allowlists and scope filtering.',
  needs: ['ast', 'fs'],
  schema: {
    type: 'object',
    properties: {
      modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Module root directories that enforce barrel-only imports',
      },
      allow: {
        type: 'array',
        items: { type: 'string' },
        description: 'Import paths that are permitted even when deep (e.g., "src/domain/testing")',
      },
      include: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for files to check. Defaults to module/**/*.ts',
      },
      exclude: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for files to skip (e.g., test files)',
      },
    },
    required: ['modules'],
  },
  async check(ctx) {
    const { modules: modulePaths, allow, include, exclude } = ctx.options;
    const allowSet = new Set(allow ?? []);
    let fileCount = 0;

    for (const modulePath of modulePaths) {
      const patterns = include ?? [`${modulePath}/**/*.ts`];
      const excludePatterns = exclude ?? [];

      for (const globPattern of patterns) {
        const files = await ctx.providers.fs.glob(globPattern);
        for (const file of files) {
          if (excludePatterns.some((ex) => file.includes(ex.replaceAll('*', '')))) continue;
          fileCount++;

          const imports = await ctx.providers.ast.getImports(file);
          for (const imp of imports) {
            if (isDeepImport(imp.source, modulePath) && !isAllowed(imp.source, allowSet)) {
              ctx.report({
                message: `Deep import into "${modulePath}" — use the barrel export instead`,
                location: imp.location,
              });
            }
          }
        }
      }
    }

    ctx.meta(`${fileCount} files`);
  },
});

/** Check if an import source reaches into a module's internals */
function isDeepImport(source: string, modulePath: string): boolean {
  if (!source.startsWith('.') && !source.startsWith('/')) return false;
  const normalized = source.replaceAll('\\', '/');
  return normalized.includes(`${modulePath}/`) && !normalized.endsWith(`${modulePath}/index`);
}

/** Check if a deep import is in the allowlist */
function isAllowed(source: string, allowSet: Set<string>): boolean {
  if (allowSet.size === 0) return false;
  const normalized = source.replaceAll('\\', '/');
  return [...allowSet].some((allowed) => normalized.includes(allowed));
}

export { modules };
