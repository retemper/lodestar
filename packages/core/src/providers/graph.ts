import { join, dirname, sep } from 'node:path';
import type {
  DependencyGraphProvider,
  ModuleGraph,
  ModuleNode,
  ASTProvider,
  FileSystemProvider,
} from '@lodestar/types';

/** Convert OS-specific path separators to forward slashes for consistent comparison */
function toForwardSlash(p: string): string {
  return sep === '\\' ? p.replaceAll('\\', '/') : p;
}

/** File extensions to try when resolving imports */
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Create a dependency graph provider that builds the import graph lazily via AST.
 * @param rootDir - absolute path used as the project root
 * @param astProvider - AST provider for extracting import statements
 * @param fsProvider - file system provider for discovering source files
 */
function createGraphProvider(
  rootDir: string,
  astProvider?: ASTProvider,
  fsProvider?: FileSystemProvider,
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

    const depsMap = new Map<string, string[]>();
    const dependentsMap = new Map<string, string[]>();

    for (const file of files) {
      const imports = await astProvider.getImports(file);
      const resolved: string[] = [];

      for (const imp of imports) {
        const target = resolveImport(file, imp.source, fileSet);
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
 * Resolve a relative import source to an actual file path.
 * @param importer - relative path of the file containing the import
 * @param source - import specifier (e.g. './utils')
 * @param knownFiles - set of all known project file paths for existence checks
 */
function resolveImport(importer: string, source: string, knownFiles: Set<string>): string | null {
  if (!source.startsWith('.') && !source.startsWith('/')) return null;

  const importerDir = dirname(importer);
  const base = normalizePath(toForwardSlash(join(importerDir, source)));

  if (knownFiles.has(base)) return base;

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}/index${ext}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}

/** Normalize path segments (resolve . and ..) */
function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const segment of p.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    if (segment) parts.push(segment);
  }
  return parts.join('/');
}

/**
 * DFS cycle detection from an entry node.
 * @param nodes - the full module graph to traverse
 * @param entry - starting node id for cycle detection
 */
function detectCycle(nodes: ReadonlyMap<string, ModuleNode>, entry: string): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

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
