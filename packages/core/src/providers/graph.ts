import type {
  DependencyGraphProvider,
  ModuleGraph,
  ModuleNode,
  ModuleResolver,
  ASTProvider,
  FileSystemProvider,
} from '@retemper/lodestar-types';
import { createDefaultResolverChain } from '../resolvers';

/**
 * Create a dependency graph provider that builds the import graph lazily via AST.
 * @param rootDir - absolute path used as the project root
 * @param astProvider - AST provider for extracting import statements
 * @param fsProvider - file system provider for discovering source files
 * @param customResolvers - additional resolvers inserted before built-in ones
 */
function createGraphProvider(
  rootDir: string,
  astProvider?: ASTProvider,
  fsProvider?: FileSystemProvider,
  customResolvers?: readonly ModuleResolver[],
): DependencyGraphProvider {
  const graphCache: { value: ModuleGraph | null } = { value: null };

  /** Build the full dependency graph by scanning all TS files */
  async function buildGraph(): Promise<ModuleGraph> {
    if (graphCache.value) return graphCache.value;

    if (!astProvider || !fsProvider) {
      graphCache.value = { nodes: new Map() };
      return graphCache.value;
    }

    const allFiles = await fsProvider.glob('**/*.ts');
    const tsxFiles = await fsProvider.glob('**/*.tsx');
    const files = [...allFiles, ...tsxFiles];
    const fileSet = new Set(files);

    const { resolver, setup } = createDefaultResolverChain({
      rootDir,
      customResolvers,
    });
    await setup();

    const depsMap = new Map<string, string[]>();
    const dependentsMap = new Map<string, string[]>();

    for (const file of files) {
      const imports = await astProvider.getImports(file);
      const resolved: string[] = [];

      for (const imp of imports) {
        const target = resolver.resolve({
          importer: file,
          source: imp.source,
          knownFiles: fileSet,
        });
        if (target) {
          resolved.push(target);
          const deps = dependentsMap.get(target) ?? [];
          deps.push(file);
          dependentsMap.set(target, deps);
        }
      }

      depsMap.set(file, resolved);
    }

    const nodes = new Map<string, ModuleNode>();
    for (const file of files) {
      nodes.set(file, {
        id: file,
        dependencies: depsMap.get(file) ?? [],
        dependents: dependentsMap.get(file) ?? [],
      });
    }

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

    async hasCircular(entry: string): Promise<boolean> {
      const graph = await buildGraph();
      return detectCycle(graph.nodes, entry);
    },

    async getModuleGraph(): Promise<ModuleGraph> {
      return buildGraph();
    },
  };
}

/**
 * DFS cycle detection from an entry node.
 * @param nodes - the full module graph to traverse
 * @param entry - starting node id for cycle detection
 */
function detectCycle(nodes: ReadonlyMap<string, ModuleNode>, entry: string): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  /** Depth-first search returning true if a cycle is found */
  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    const node = nodes.get(nodeId);
    if (node) {
      for (const dep of node.dependencies) {
        if (dfs(dep)) return true;
      }
    }

    inStack.delete(nodeId);
    return false;
  }

  return dfs(entry);
}

export { createGraphProvider };
