import { defineRule } from '@lodestar/types';

/** Dependency direction rule */
interface DependencyLayer {
  readonly name: string;
  readonly pattern: string;
}

/** Enforce unidirectional dependency flow between named layers */
const dependencyDirection = defineRule<{
  layers: readonly DependencyLayer[];
}>({
  name: 'deps/dependency-direction',
  description: 'Enforces that dependencies flow in one direction through named layers',
  needs: ['graph', 'fs'],
  schema: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            pattern: { type: 'string' },
          },
          required: ['name', 'pattern'],
        },
        description: 'Ordered from bottom to top. Lower layers cannot depend on upper layers.',
      },
    },
    required: ['layers'],
  },
  async check(ctx) {
    const { layers } = ctx.options;

    for (const [layerIndex, layer] of layers.entries()) {
      const files = await ctx.providers.fs.glob(layer.pattern);

      for (const file of files) {
        const deps = await ctx.providers.graph.getDependencies(file);

        for (const dep of deps) {
          const depLayerIndex = layers.findIndex((l) =>
            dep.match(new RegExp(l.pattern.replace('**/*', '.*'))),
          );

          if (depLayerIndex > layerIndex) {
            ctx.report({
              message: `"${layer.name}" layer cannot depend on "${layers[depLayerIndex].name}" layer`,
              location: { file },
            });
          }
        }
      }
    }
  },
});

export { dependencyDirection };
export type { DependencyLayer };
