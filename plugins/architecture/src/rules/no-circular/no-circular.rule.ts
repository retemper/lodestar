import { defineRule } from '@lodestar/types';
import { matchGlob } from '../../shared/match-glob';

/** Detect circular dependencies with configurable scope and depth */
const noCircular = defineRule<{
  /** Glob patterns for entry points to scan — defaults to all graph nodes */
  readonly entries?: readonly string[];
  /** Glob patterns for files to exclude from circular detection */
  readonly ignore?: readonly string[];
  /** Maximum cycle chain length to report — longer cycles are ignored */
  readonly maxDepth?: number;
}>({
  name: 'architecture/no-circular',
  description:
    'Detects circular dependency chains. Supports entry point filtering, ignore patterns, and max chain depth.',
  needs: ['graph'],
  schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for entry points to scan. Defaults to all nodes in the graph.',
      },
      ignore: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Glob patterns for files to exclude from circular detection (e.g., test helpers, generated code).',
      },
      maxDepth: {
        type: 'number',
        description:
          'Maximum cycle chain length to report. Cycles longer than this are ignored. Useful for incremental adoption.',
      },
    },
  },
  async check(ctx) {
    const { entries, ignore, maxDepth } = ctx.options;
    const graph = await ctx.providers.graph.getModuleGraph();
    let nodeCount = 0;

    for (const [id] of graph.nodes) {
      nodeCount++;
      if (ignore?.some((pattern) => matchGlob(id, pattern))) continue;
      if (entries && !entries.some((pattern) => matchGlob(id, pattern))) continue;

      const hasCircular = await ctx.providers.graph.hasCircular(id);
      if (!hasCircular) continue;

      if (maxDepth !== undefined) {
        const chainLength = estimateChainLength(graph.nodes, id);
        if (chainLength > maxDepth) continue;
      }

      ctx.report({
        message: `Circular dependency detected starting from "${id}"`,
        location: { file: id },
      });
    }

    ctx.meta(`${nodeCount} modules`);
  },
});

/**
 * Estimate cycle chain length via BFS back to start node.
 * @param nodes - dependency graph adjacency map
 * @param startId - module ID to trace the cycle from
 */
function estimateChainLength(
  nodes: ReadonlyMap<string, { readonly dependencies: readonly string[] }>,
  startId: string,
): number {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth > 0 && current.id === startId) {
      return current.depth;
    }
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const node = nodes.get(current.id);
    if (!node) continue;

    for (const dep of node.dependencies) {
      queue.push({ id: dep, depth: current.depth + 1 });
    }
  }

  return Infinity;
}

export { noCircular, estimateChainLength };
