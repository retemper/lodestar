import { defineRule } from '@lodestar/types';

/** Enforce layer dependency direction */
const noCrossLayer = defineRule<{
  layers: readonly string[];
}>({
  name: 'boundary/no-cross-layer',
  description: 'Enforces that imports only flow from upper layers to lower layers',
  needs: ['ast', 'fs'],
  schema: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Ordered layers from bottom (shared) to top (entry). Lower cannot import upper.',
      },
    },
    required: ['layers'],
  },
  async check(ctx) {
    const { layers } = ctx.options;

    for (const [layerIndex, layer] of layers.entries()) {
      const files = await ctx.providers.fs.glob(`${layer}/**/*.ts`);

      for (const file of files) {
        const imports = await ctx.providers.ast.getImports(file);

        for (const imp of imports) {
          const importedLayerIndex = layers.findIndex((l) => imp.source.startsWith(l));
          if (importedLayerIndex > layerIndex) {
            ctx.report({
              message: `Layer violation: "${layer}" cannot import from "${layers[importedLayerIndex]}"`,
              location: imp.location,
            });
          }
        }
      }
    }
  },
});

export { noCrossLayer };
