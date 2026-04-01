import type { DependencyGraphProvider, ModuleGraph, ModuleNode } from '@lodestar/types';

/** Create a dependency graph provider (builds import graph lazily) */
function createGraphProvider(rootDir: string): DependencyGraphProvider {
  const graphCache: { value: ModuleGraph | null } = { value: null };

  async function buildGraph(): Promise<ModuleGraph> {
    if (graphCache.value) return graphCache.value;

    const nodes = new Map<string, ModuleNode>();
    // TODO: Implement full import graph building via AST walking
    graphCache.value = { nodes };
    return graphCache.value;
  }

  return {
    async getDependencies(file: string): Promise<readonly string[]> {
      const graph = await buildGraph();
      return graph.nodes.get(file)?.dependencies ?? [];
    },

    async getDependents(file: string): Promise<readonly string[]> {
      const graph = await buildGraph();
      return graph.nodes.get(file)?.dependents ?? [];
    },

    async hasCircular(_entry: string): Promise<boolean> {
      // TODO: Implement cycle detection
      return false;
    },

    async getModuleGraph(): Promise<ModuleGraph> {
      return buildGraph();
    },
  };
}

export { createGraphProvider };
