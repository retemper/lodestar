import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import { createProviders, loadConfigFile } from '@retemper/lodestar';
import type { ModuleNode } from '@retemper/lodestar';

/** Supported graph output formats */
type GraphFormat = 'mermaid' | 'dot';

/** Options for the graph visualization command */
interface GraphOptions {
  /** Glob pattern to filter which files appear in the output */
  readonly scope?: string;
  /** Output format for the dependency graph */
  readonly format: GraphFormat;
  /** Show layer-level graph instead of file-level */
  readonly layers?: boolean;
}

/** A layer definition extracted from architecture/layers config */
interface LayerDef {
  readonly name: string;
  readonly path: string;
  readonly canImport?: readonly string[];
}

/** An edge between two layers with metadata */
interface LayerEdge {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly allowed: boolean;
}

/**
 * Test whether a file path matches a simple glob scope prefix.
 * @param filePath - the file path to test
 * @param scope - the scope pattern (e.g. "src/domain" or "src/domain/**")
 */
function matchesScope(filePath: string, scope: string): boolean {
  const normalized = scope.replace(/\/\*\*$/, '').replace(/\/\*$/, '');
  return filePath.startsWith(normalized);
}

/**
 * Collect file-level edges from the module graph, optionally filtered by a scope pattern.
 * @param nodes - full module graph nodes
 * @param scope - optional glob-like prefix filter
 */
function collectEdges(
  nodes: ReadonlyMap<string, ModuleNode>,
  scope: string | undefined,
): ReadonlyArray<{ readonly from: string; readonly to: string }> {
  const edges: Array<{ readonly from: string; readonly to: string }> = [];

  for (const [id, node] of nodes) {
    if (scope && !matchesScope(id, scope)) continue;

    for (const dep of node.dependencies) {
      if (scope && !matchesScope(dep, scope)) continue;
      edges.push({ from: id, to: dep });
    }
  }

  return edges;
}

/**
 * Match a file path against a glob pattern with * and ** wildcards.
 * @param path - file path to test
 * @param pattern - glob pattern
 */
function matchGlob(path: string, pattern: string): boolean {
  const regex = pattern
    .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**/', '(?:.*/)?')
    .replaceAll('**', '.*')
    .replaceAll('*', '[^/]*');
  return new RegExp(`^${regex}$`).test(path);
}

/**
 * Build layer-level edges by aggregating file-level dependencies.
 * @param layerDefs - layer definitions from config
 * @param nodes - full module graph
 */
function collectLayerEdges(
  layerDefs: readonly LayerDef[],
  nodes: ReadonlyMap<string, ModuleNode>,
): readonly LayerEdge[] {
  const fileToLayer = new Map<string, string>();

  for (const [id] of nodes) {
    for (const layer of layerDefs) {
      if (matchGlob(id, layer.path)) {
        fileToLayer.set(id, layer.name);
        break;
      }
    }
  }

  const allowedImports = new Map<string, ReadonlySet<string>>();
  for (const layer of layerDefs) {
    allowedImports.set(layer.name, new Set(layer.canImport ?? []));
  }

  const edgeCounts = new Map<string, { count: number; allowed: boolean }>();

  for (const [id, node] of nodes) {
    const sourceLayer = fileToLayer.get(id);
    if (!sourceLayer) continue;

    for (const dep of node.dependencies) {
      const targetLayer = fileToLayer.get(dep);
      if (!targetLayer || targetLayer === sourceLayer) continue;

      const key = `${sourceLayer}->${targetLayer}`;
      const existing = edgeCounts.get(key);
      const allowed = allowedImports.get(sourceLayer)?.has(targetLayer) ?? false;

      if (existing) {
        existing.count++;
      } else {
        edgeCounts.set(key, { count: 1, allowed });
      }
    }
  }

  const edges: LayerEdge[] = [];
  for (const [key, value] of edgeCounts) {
    const [from, to] = key.split('->');
    edges.push({ from, to, count: value.count, allowed: value.allowed });
  }

  return edges;
}

/**
 * Format layer edges as a Mermaid graph. Violations are shown as dotted red lines.
 * @param layerDefs - layer definitions for node listing
 * @param edges - aggregated layer-to-layer edges
 */
function formatLayerMermaid(layerDefs: readonly LayerDef[], edges: readonly LayerEdge[]): string {
  const lines = ['graph TD'];

  const connectedLayers = new Set<string>();
  for (const edge of edges) {
    connectedLayers.add(edge.from);
    connectedLayers.add(edge.to);
  }

  for (const layer of layerDefs) {
    if (!connectedLayers.has(layer.name)) {
      lines.push(`  ${layer.name}`);
    }
  }

  for (const edge of edges) {
    if (edge.allowed) {
      lines.push(`  ${edge.from} -->|${edge.count}| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} -.->|"violation (${edge.count})"| ${edge.to}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format layer edges as a Graphviz DOT definition. Violations are red dashed.
 * @param layerDefs - layer definitions for node listing
 * @param edges - aggregated layer-to-layer edges
 */
function formatLayerDot(layerDefs: readonly LayerDef[], edges: readonly LayerEdge[]): string {
  const lines = ['digraph architecture {'];

  for (const layer of layerDefs) {
    lines.push(`  "${layer.name}";`);
  }

  for (const edge of edges) {
    if (edge.allowed) {
      lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.count}"];`);
    } else {
      lines.push(
        `  "${edge.from}" -> "${edge.to}" [label="violation (${edge.count})" style=dashed color=red];`,
      );
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/** Format file-level edges as Mermaid */
function formatMermaid(
  edges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
): string {
  const lines = ['graph TD'];

  for (const edge of edges) {
    lines.push(`  "${edge.from}" --> "${edge.to}"`);
  }

  return lines.join('\n');
}

/** Format file-level edges as Graphviz DOT */
function formatDot(edges: ReadonlyArray<{ readonly from: string; readonly to: string }>): string {
  const lines = ['digraph dependencies {'];

  for (const edge of edges) {
    lines.push(`  "${edge.from}" -> "${edge.to}";`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Extract layer definitions from the loaded config's architecture/layers rule.
 * @param rootDir - project root to search for lodestar.config.ts
 */
async function extractLayerDefs(rootDir: string): Promise<readonly LayerDef[] | null> {
  const config = await loadConfigFile(rootDir);
  if (!config) return null;

  const blocks = Array.isArray(config) ? config : [config];
  for (const block of blocks) {
    const layerRule = block.rules?.['architecture/layers'];
    if (!layerRule || typeof layerRule === 'string') continue;
    const options = (layerRule as { options?: { layers?: readonly LayerDef[] } }).options;
    if (options?.layers) return options.layers;
  }
  return null;
}

/**
 * Execute the graph command -- outputs the project dependency graph.
 * With --layers, shows layer-level architecture. Without, shows file-level dependencies.
 * @param args - parsed CLI arguments
 */
async function graphCommand(args: ArgumentsCamelCase<GraphOptions>): Promise<void> {
  const rootDir = resolve(process.cwd());

  if (args.layers) {
    const layerDefs = await extractLayerDefs(rootDir);
    if (!layerDefs || layerDefs.length === 0) {
      console.error(
        'No architecture/layers rule found in lodestar.config.ts. Configure layers first.',
      );
      process.exitCode = 1;
      return;
    }

    const providers = createProviders(rootDir);
    const moduleGraph = await providers.graph.getModuleGraph();
    const layerEdges = collectLayerEdges(layerDefs, moduleGraph.nodes);

    const output =
      args.format === 'dot'
        ? formatLayerDot(layerDefs, layerEdges)
        : formatLayerMermaid(layerDefs, layerEdges);

    process.stdout.write(output + '\n');
    return;
  }

  const providers = createProviders(rootDir);
  const moduleGraph = await providers.graph.getModuleGraph();

  const edges = collectEdges(moduleGraph.nodes, args.scope);

  if (edges.length === 0) {
    console.error('No dependencies found.');
    return;
  }

  const output = args.format === 'dot' ? formatDot(edges) : formatMermaid(edges);

  process.stdout.write(output + '\n');
}

export {
  graphCommand,
  collectEdges,
  collectLayerEdges,
  formatMermaid,
  formatDot,
  formatLayerMermaid,
  formatLayerDot,
  matchesScope,
};
export type { GraphOptions, GraphFormat, LayerDef, LayerEdge };
