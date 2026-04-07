import { defineRule } from '@retemper/lodestar-types';
import { resolveImport } from '../../shared/resolve-import';

/** A named layer with a file pattern and allowed import targets */
interface LayerDefinition {
  readonly name: string;
  readonly path: string;
  readonly canImport?: readonly string[];
}

/** Enforce intra-package dependency direction between architectural layers */
const layers = defineRule<{
  readonly layers: readonly LayerDefinition[];
  readonly allowTypeOnly?: boolean;
}>({
  name: 'architecture/layers',
  description:
    'Enforces dependency direction between architectural layers. Each layer declares which other layers it may import from.',
  needs: ['ast', 'fs'],
  schema: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Human-readable layer name' },
            path: { type: 'string', description: 'Glob pattern matching files in this layer' },
            canImport: {
              type: 'array',
              items: { type: 'string' },
              description: 'Layer names this layer is allowed to import from',
            },
          },
          required: ['name', 'path'],
        },
        description: 'Layer definitions with dependency constraints',
      },
      allowTypeOnly: {
        type: 'boolean',
        description: 'When true, type-only cross-layer imports are permitted (default: false)',
      },
    },
    required: ['layers'],
  },
  async check(ctx) {
    const { layers: layerDefs, allowTypeOnly = false } = ctx.options;

    const fileToLayer = new Map<string, LayerDefinition>();
    const knownFiles = new Set<string>();

    for (const layer of layerDefs) {
      const files = await ctx.providers.fs.glob(layer.path);
      for (const file of files) {
        fileToLayer.set(file, layer);
        knownFiles.add(file);
      }
    }

    const allowedLayers = new Map<string, ReadonlySet<string>>();
    for (const layer of layerDefs) {
      allowedLayers.set(layer.name, new Set(layer.canImport ?? []));
    }

    for (const [file, sourceLayer] of fileToLayer) {
      const imports = await ctx.providers.ast.getImports(file);
      const allowed = allowedLayers.get(sourceLayer.name) ?? new Set<string>();

      for (const imp of imports) {
        if (allowTypeOnly && imp.isTypeOnly) continue;

        const resolved = resolveImport(file, imp.source, knownFiles);
        if (!resolved) continue;

        const targetLayer = fileToLayer.get(resolved);
        if (!targetLayer) continue;
        if (targetLayer.name === sourceLayer.name) continue;

        if (!allowed.has(targetLayer.name)) {
          ctx.report({
            message: `Layer "${sourceLayer.name}" cannot import from "${targetLayer.name}" — not listed in canImport`,
            location: imp.location,
          });
        }
      }
    }

    ctx.meta(`${knownFiles.size} files, ${layerDefs.length} layers`);
  },
});

export { layers };
export type { LayerDefinition };
