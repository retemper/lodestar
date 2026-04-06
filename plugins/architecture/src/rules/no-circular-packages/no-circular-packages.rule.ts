import { defineRule } from '@lodestar/types';

/** Represents a single workspace package and its internal dependency edges */
interface PackageNode {
  /** Package name from package.json (e.g., "@lodestar/types") */
  readonly name: string;
  /** Relative path to the package directory */
  readonly dir: string;
  /** Names of internal packages this package depends on */
  readonly internalDeps: readonly string[];
}

/** Detect circular dependencies between workspace packages */
const noCircularPackages = defineRule<{
  /** Package scope prefix to treat as internal (e.g., "@lodestar") — auto-detected if omitted */
  readonly scope?: string;
}>({
  name: 'architecture/no-circular-packages',
  description:
    'Detects circular dependencies between workspace packages by analyzing package.json dependencies.',
  needs: ['fs', 'config'],
  schema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description:
          'Package scope prefix to consider as internal (e.g., "@lodestar"). Defaults to auto-detecting from the first workspace package found.',
      },
    },
  },
  async check(ctx) {
    const packageDirs = await discoverPackageDirs(ctx);
    if (packageDirs.length === 0) return;

    const packages = await buildPackageNodes(ctx, packageDirs);
    const scope = ctx.options.scope ?? detectScope(packages);
    if (!scope) return;

    const internalNames = new Set(packages.map((p) => p.name));
    const graph = new Map<string, readonly string[]>();

    for (const pkg of packages) {
      const deps = pkg.internalDeps.filter((d) => internalNames.has(d));
      graph.set(pkg.name, deps);
    }

    const cycles = detectCycles(graph);

    for (const cycle of cycles) {
      ctx.report({
        message: `Circular package dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
      });
    }

    ctx.meta(`${packages.length} packages`);
  },
});

/** Discover all package directories via workspace glob patterns */
async function discoverPackageDirs(ctx: {
  providers: { fs: { glob(p: string): Promise<readonly string[]> } };
}): Promise<readonly string[]> {
  const patterns = ['packages/*/package.json', 'plugins/*/package.json'];
  const dirs: string[] = [];

  for (const pattern of patterns) {
    const matches = await ctx.providers.fs.glob(pattern);
    for (const match of matches) {
      dirs.push(match.replace('/package.json', ''));
    }
  }

  return dirs;
}

/** Read all package.json files and extract internal dependency info */
async function buildPackageNodes(
  ctx: { providers: { fs: { readJson<T>(p: string): Promise<T> } } },
  dirs: readonly string[],
): Promise<readonly PackageNode[]> {
  const nodes: PackageNode[] = [];

  for (const dir of dirs) {
    const pkg = await ctx.providers.fs.readJson<{
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    }>(`${dir}/package.json`);

    if (!pkg.name) continue;

    const allDeps = Object.keys(pkg.dependencies ?? {});

    nodes.push({
      name: pkg.name,
      dir,
      internalDeps: allDeps,
    });
  }

  return nodes;
}

/** Auto-detect the internal scope from package names */
function detectScope(packages: readonly PackageNode[]): string | null {
  for (const pkg of packages) {
    if (pkg.name.startsWith('@')) {
      const scopeEnd = pkg.name.indexOf('/');
      if (scopeEnd > 0) return pkg.name.slice(0, scopeEnd);
    }
  }
  return null;
}

/** Find all cycles in a directed graph via DFS */
function detectCycles(
  graph: ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];
  const cycles: string[][] = [];

  /** Recursively walk the graph, tracking visited nodes and current stack to detect back-edges */
  function dfs(node: string): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (graph.has(dep)) {
        dfs(dep);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  return cycles;
}

export { noCircularPackages, detectCycles };
