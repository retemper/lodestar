import { defineRule } from '@lodestar/types';

/** Forbid deep imports bypassing barrel files */
const noDeepImport = defineRule<{
  modules: readonly string[];
}>({
  name: 'boundary/no-deep-import',
  description: 'Forbids importing internal files of a module, requiring barrel (index) imports',
  needs: ['ast'],
  schema: {
    type: 'object',
    properties: {
      modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Module root directories that enforce barrel-only imports',
      },
    },
    required: ['modules'],
  },
  async check(ctx) {
    for (const modulePath of ctx.options.modules) {
      const files = await ctx.providers.fs.glob(`${modulePath}/**/*.ts`);
      for (const file of files) {
        const imports = await ctx.providers.ast.getImports(file);
        for (const imp of imports) {
          if (isDeepImport(imp.source, modulePath, file)) {
            ctx.report({
              message: `Deep import into "${modulePath}" — use the barrel export instead`,
              location: imp.location,
            });
          }
        }
      }
    }
  },
});

/** Check if an import source is a deep import into a module */
function isDeepImport(source: string, modulePath: string, _currentFile: string): boolean {
  if (!source.startsWith('.') && !source.startsWith('/')) return false;
  const normalized = source.replace(/\\/g, '/');
  return normalized.includes(`${modulePath}/`) && !normalized.endsWith(`${modulePath}/index`);
}

export { noDeepImport };
