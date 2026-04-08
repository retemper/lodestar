import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { createProviders, loadConfigFile, createLogger } from '@retemper/lodestar';
import type { Logger, ModuleNode } from '@retemper/lodestar';

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
  /** Start a local HTTP server with interactive graph visualization */
  readonly serve?: boolean;
  /** Port for the interactive server */
  readonly port?: number;
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

/** JSON shape served by /api/graph for the interactive viewer */
interface GraphApiResponse {
  readonly nodes: readonly GraphApiNode[];
  readonly edges: readonly GraphApiEdge[];
  readonly layers: readonly GraphApiLayer[];
}

/** Node in the interactive graph */
interface GraphApiNode {
  readonly id: string;
  readonly layer?: string;
  readonly size: number;
}

/** Edge in the interactive graph */
interface GraphApiEdge {
  readonly source: string;
  readonly target: string;
  readonly allowed: boolean;
}

/** Layer metadata for coloring */
interface GraphApiLayer {
  readonly name: string;
  readonly fileCount: number;
}

/** Build a graph API response from module graph and optional layer definitions */
function buildGraphApiResponse(
  nodes: ReadonlyMap<string, ModuleNode>,
  scope: string | undefined,
  layerDefs: readonly LayerDef[] | null,
): GraphApiResponse {
  const fileToLayer = new Map<string, string>();
  const layerCounts = new Map<string, number>();

  if (layerDefs) {
    for (const [id] of nodes) {
      for (const layer of layerDefs) {
        if (matchGlob(id, layer.path)) {
          fileToLayer.set(id, layer.name);
          layerCounts.set(layer.name, (layerCounts.get(layer.name) ?? 0) + 1);
          break;
        }
      }
    }
  }

  const allowedImports = new Map<string, ReadonlySet<string>>();
  if (layerDefs) {
    for (const layer of layerDefs) {
      allowedImports.set(layer.name, new Set(layer.canImport ?? []));
    }
  }

  const apiNodes: GraphApiNode[] = [];
  const apiEdges: GraphApiEdge[] = [];

  for (const [id, node] of nodes) {
    if (scope && !matchesScope(id, scope)) continue;

    apiNodes.push({
      id,
      layer: fileToLayer.get(id),
      size: node.dependencies.length,
    });

    for (const dep of node.dependencies) {
      if (scope && !matchesScope(dep, scope)) continue;
      const sourceLayer = fileToLayer.get(id);
      const targetLayer = fileToLayer.get(dep);
      const sameLayer = sourceLayer === targetLayer;
      const allowed =
        sameLayer ||
        !sourceLayer ||
        !targetLayer ||
        (allowedImports.get(sourceLayer)?.has(targetLayer) ?? true);

      apiEdges.push({ source: id, target: dep, allowed });
    }
  }

  const apiLayers: GraphApiLayer[] = layerDefs
    ? layerDefs.map((l) => ({ name: l.name, fileCount: layerCounts.get(l.name) ?? 0 }))
    : [];

  return { nodes: apiNodes, edges: apiEdges, layers: apiLayers };
}

/** Inline HTML page for the interactive graph viewer */
function getGraphViewerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lodestar — Dependency Graph</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0d1117; color: #c9d1d9; overflow: hidden; }
  #controls { position: fixed; top: 12px; left: 12px; z-index: 10; display: flex; gap: 8px; align-items: center; }
  #controls input { padding: 6px 10px; border-radius: 6px; border: 1px solid #30363d; background: #161b22; color: #c9d1d9; font-size: 14px; width: 240px; }
  #controls select { padding: 6px 8px; border-radius: 6px; border: 1px solid #30363d; background: #161b22; color: #c9d1d9; font-size: 13px; }
  #info { position: fixed; bottom: 12px; left: 12px; font-size: 12px; color: #8b949e; }
  svg { width: 100vw; height: 100vh; }
  .link { stroke: #30363d; stroke-width: 1; fill: none; marker-end: url(#arrow); }
  .link.violation { stroke: #f85149; stroke-dasharray: 4 2; marker-end: url(#arrow-violation); }
  .link.highlight { stroke: #58a6ff; stroke-width: 2; }
  .node circle { cursor: pointer; stroke: #30363d; stroke-width: 1.5; }
  .node text { font-size: 10px; fill: #8b949e; pointer-events: none; }
  .node.selected circle { stroke: #58a6ff; stroke-width: 3; }
  .node.dimmed { opacity: 0.15; }
  .link.dimmed { opacity: 0.05; }
</style>
</head>
<body>
<div id="controls">
  <input id="search" type="text" placeholder="Search files...">
  <select id="layerFilter"><option value="">All layers</option></select>
</div>
<div id="info">Loading graph...</div>
<svg id="graph"></svg>
<script>
const COLORS = ['#58a6ff','#3fb950','#d2a8ff','#f0883e','#f778ba','#79c0ff','#56d364','#e3b341'];
let simulation, nodeEls, linkEls, graphData;

async function init() {
  const res = await fetch('/api/graph');
  graphData = await res.json();
  document.getElementById('info').textContent = graphData.nodes.length + ' files, ' + graphData.edges.length + ' edges' + (graphData.layers.length ? ', ' + graphData.layers.length + ' layers' : '');

  const layerFilter = document.getElementById('layerFilter');
  graphData.layers.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.name; opt.textContent = l.name + ' (' + l.fileCount + ')';
    layerFilter.appendChild(opt);
  });

  const layerColor = {};
  graphData.layers.forEach((l, i) => { layerColor[l.name] = COLORS[i % COLORS.length]; });

  const svg = document.getElementById('graph');
  const ns = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(ns, 'defs');
  ['arrow','arrow-violation'].forEach((id, i) => {
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', id); marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '20'); marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', i === 0 ? '#30363d' : '#f85149');
    marker.appendChild(path); defs.appendChild(marker);
  });
  svg.appendChild(defs);

  const g = document.createElementNS(ns, 'g');
  svg.appendChild(g);

  // Zoom/pan
  let transform = {x:0,y:0,k:1};
  function applyTransform() { g.setAttribute('transform', 'translate('+transform.x+','+transform.y+') scale('+transform.k+')'); }
  svg.addEventListener('wheel', e => { e.preventDefault(); const s = e.deltaY > 0 ? 0.9 : 1.1; transform.k *= s; transform.x = e.clientX - (e.clientX - transform.x) * s; transform.y = e.clientY - (e.clientY - transform.y) * s; applyTransform(); });
  let drag = null;
  svg.addEventListener('mousedown', e => { if (e.target === svg || e.target === g) drag = {x: e.clientX - transform.x, y: e.clientY - transform.y}; });
  svg.addEventListener('mousemove', e => { if (drag) { transform.x = e.clientX - drag.x; transform.y = e.clientY - drag.y; applyTransform(); }});
  svg.addEventListener('mouseup', () => { drag = null; });

  // Links
  linkEls = graphData.edges.map(e => {
    const line = document.createElementNS(ns, 'line');
    line.classList.add('link');
    if (!e.allowed) line.classList.add('violation');
    line.dataset.source = e.source; line.dataset.target = e.target;
    g.appendChild(line); return line;
  });

  // Nodes
  const w = window.innerWidth, h = window.innerHeight;
  const nodeMap = {};
  graphData.nodes.forEach(n => { n.x = w/2 + (Math.random()-0.5)*w*0.6; n.y = h/2 + (Math.random()-0.5)*h*0.6; nodeMap[n.id] = n; });

  nodeEls = graphData.nodes.map(n => {
    const gNode = document.createElementNS(ns, 'g');
    gNode.classList.add('node'); gNode.dataset.id = n.id;
    const circle = document.createElementNS(ns, 'circle');
    const r = Math.max(3, Math.min(12, 3 + n.size));
    circle.setAttribute('r', r);
    circle.setAttribute('fill', n.layer && layerColor[n.layer] ? layerColor[n.layer] : '#8b949e');
    gNode.appendChild(circle);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('dx', r + 3); text.setAttribute('dy', 4);
    text.textContent = n.id.split('/').pop();
    gNode.appendChild(text);
    gNode.addEventListener('click', () => selectNode(n.id));
    g.appendChild(gNode); return gNode;
  });

  // Simple force simulation (no d3 dependency)
  const alpha = {value: 1};
  function tick() {
    alpha.value *= 0.99;
    if (alpha.value < 0.001) return;
    // Repulsion
    for (let i = 0; i < graphData.nodes.length; i++) {
      for (let j = i+1; j < graphData.nodes.length; j++) {
        const a = graphData.nodes[i], b = graphData.nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        const force = 800 / (d * d);
        dx *= force; dy *= force;
        a.x -= dx; a.y -= dy; b.x += dx; b.y += dy;
      }
    }
    // Attraction (links)
    graphData.edges.forEach(e => {
      const s = nodeMap[e.source], t = nodeMap[e.target];
      if (!s || !t) return;
      let dx = t.x - s.x, dy = t.y - s.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      const force = (d - 80) * 0.005;
      dx = dx/d * force; dy = dy/d * force;
      s.x += dx; s.y += dy; t.x -= dx; t.y -= dy;
    });
    // Center gravity
    graphData.nodes.forEach(n => { n.x += (w/2 - n.x) * 0.001; n.y += (h/2 - n.y) * 0.001; });
    // Update DOM
    nodeEls.forEach((el, i) => { const n = graphData.nodes[i]; el.setAttribute('transform', 'translate('+n.x+','+n.y+')'); });
    linkEls.forEach((el, i) => { const e = graphData.edges[i]; const s = nodeMap[e.source], t = nodeMap[e.target]; if(s&&t){el.setAttribute('x1',s.x);el.setAttribute('y1',s.y);el.setAttribute('x2',t.x);el.setAttribute('y2',t.y);}});
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Search
  document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    nodeEls.forEach((el, i) => {
      const match = !q || graphData.nodes[i].id.toLowerCase().includes(q);
      el.classList.toggle('dimmed', !match);
    });
    linkEls.forEach(el => {
      const sMatch = !q || el.dataset.source.toLowerCase().includes(q);
      const tMatch = !q || el.dataset.target.toLowerCase().includes(q);
      el.classList.toggle('dimmed', !(sMatch || tMatch));
    });
  });

  // Layer filter
  layerFilter.addEventListener('change', e => {
    const layer = e.target.value;
    nodeEls.forEach((el, i) => {
      const match = !layer || graphData.nodes[i].layer === layer;
      el.classList.toggle('dimmed', !match);
    });
    linkEls.forEach((el, i) => {
      const e2 = graphData.edges[i];
      const sLayer = nodeMap[e2.source]?.layer, tLayer = nodeMap[e2.target]?.layer;
      const match = !layer || sLayer === layer || tLayer === layer;
      el.classList.toggle('dimmed', !match);
    });
  });
}

function selectNode(id) {
  const deps = new Set(), depBy = new Set();
  graphData.edges.forEach(e => { if (e.source === id) deps.add(e.target); if (e.target === id) depBy.add(e.source); });
  const connected = new Set([id, ...deps, ...depBy]);
  nodeEls.forEach((el, i) => {
    el.classList.toggle('selected', graphData.nodes[i].id === id);
    el.classList.toggle('dimmed', !connected.has(graphData.nodes[i].id));
  });
  linkEls.forEach((el, i) => {
    const e = graphData.edges[i];
    const isConn = e.source === id || e.target === id;
    el.classList.toggle('highlight', isConn);
    el.classList.toggle('dimmed', !isConn);
  });
}

init();
</script>
</body>
</html>`;
}

/**
 * Start an interactive graph server.
 * @param rootDir - project root
 * @param scope - optional scope filter
 * @param port - HTTP port
 */
async function startGraphServer(
  rootDir: string,
  scope: string | undefined,
  port: number,
  logger: Logger,
): Promise<void> {
  const providers = createProviders(rootDir);
  const moduleGraph = await providers.graph.getModuleGraph();
  const layerDefs = await extractLayerDefs(rootDir);
  const apiResponse = buildGraphApiResponse(moduleGraph.nodes, scope, layerDefs ?? null);

  const server = createServer((req, res) => {
    if (req.url === '/api/graph') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(apiResponse));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getGraphViewerHtml());
    }
  });

  server.listen(port, () => {
    logger.info(`Lodestar graph server running at http://localhost:${port}`);
    logger.info(`${apiResponse.nodes.length} files, ${apiResponse.edges.length} edges`);
    logger.info('Press Ctrl+C to stop');
  });
}

/**
 * Execute the graph command -- outputs the project dependency graph.
 * With --layers, shows layer-level architecture. Without, shows file-level dependencies.
 * @param args - parsed CLI arguments
 */
async function graphCommand(args: ArgumentsCamelCase<GraphOptions>): Promise<void> {
  const logger = createLogger();
  const rootDir = resolve(process.cwd());

  if (args.serve) {
    await startGraphServer(rootDir, args.scope, args.port ?? 4040, logger);
    return;
  }

  if (args.layers) {
    const layerDefs = await extractLayerDefs(rootDir);
    if (!layerDefs || layerDefs.length === 0) {
      logger.error(
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
    logger.info('No dependencies found.');
    return;
  }

  const output = args.format === 'dot' ? formatDot(edges) : formatMermaid(edges);

  process.stdout.write(output + '\n');
}

export {
  buildGraphApiResponse,
  collectEdges,
  collectLayerEdges,
  formatDot,
  formatLayerDot,
  formatLayerMermaid,
  formatMermaid,
  graphCommand,
  matchesScope,
};
export type {
  GraphApiEdge,
  GraphApiLayer,
  GraphApiNode,
  GraphApiResponse,
  GraphFormat,
  GraphOptions,
  LayerDef,
  LayerEdge,
};
