import { defineRule } from '@lodestar/types';

/** Detect circular dependencies */
const noCircular = defineRule<{
  entries?: readonly string[];
}>({
  name: 'deps/no-circular',
  description: 'Detects circular dependency chains',
  needs: ['graph'],
  async check(ctx) {
    const graph = await ctx.providers.graph.getModuleGraph();

    for (const [id] of graph.nodes) {
      const hasCircular = await ctx.providers.graph.hasCircular(id);
      if (hasCircular) {
        ctx.report({
          message: `Circular dependency detected starting from "${id}"`,
          location: { file: id },
        });
      }
    }
  },
});

export { noCircular };
