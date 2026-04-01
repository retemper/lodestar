import { defineRule } from '@lodestar/types';

/** Manifest (module.json) shape */
interface ModuleManifest {
  readonly imports?: Readonly<Record<string, string>>;
  readonly exports?: readonly string[];
}

/** Ensure imports match module.json#imports declarations */
const manifestImports = defineRule<{
  manifestFile: string;
}>({
  name: 'boundary/manifest-imports',
  description: 'Ensures that imports within a module match its module.json#imports declarations',
  needs: ['ast', 'config'],
  schema: {
    type: 'object',
    properties: {
      manifestFile: {
        type: 'string',
        description: 'Name of the module manifest file (e.g., module.json)',
      },
    },
  },
  async check(ctx) {
    const manifestFile = ctx.options.manifestFile ?? 'module.json';

    const hasManifest = await ctx.providers.fs.exists(manifestFile);
    if (!hasManifest) return;

    const manifest = await ctx.providers.fs.readJson<ModuleManifest>(manifestFile);
    const allowedImports = new Set(Object.keys(manifest.imports ?? {}));

    const files = await ctx.providers.fs.glob('**/*.ts');
    for (const file of files) {
      const imports = await ctx.providers.ast.getImports(file);
      for (const imp of imports) {
        if (imp.source.startsWith('#') && !allowedImports.has(imp.source)) {
          ctx.report({
            message: `Import "${imp.source}" is not declared in ${manifestFile}#imports`,
            location: imp.location,
          });
        }
      }
    }
  },
});

export { manifestImports };
export type { ModuleManifest };
