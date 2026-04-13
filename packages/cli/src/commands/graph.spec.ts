import { describe, it, expect } from 'vitest';
import type { ModuleNode } from '@retemper/lodestar';
import {
  buildGraphApiResponse,
  collectEdges,
  collectLayerEdges,
  formatDot,
  formatLayerDot,
  formatLayerMermaid,
  formatMermaid,
  matchesScope,
} from './graph';
import type { LayerDef } from './graph';

/** Creates a module graph for testing */
function makeNodes(defs: Record<string, string[]>): ReadonlyMap<string, ModuleNode> {
  const nodes = new Map<string, ModuleNode>();
  for (const [id, deps] of Object.entries(defs)) {
    nodes.set(id, { id, dependencies: deps, dependents: [] });
  }
  return nodes;
}

describe('matchesScope', () => {
  it('returns true when prefix matches', () => {
    expect(matchesScope('src/domain/entity.ts', 'src/domain')).toBe(true);
  });

  it('returns false when prefix does not match', () => {
    expect(matchesScope('src/infra/repo.ts', 'src/domain')).toBe(false);
  });

  it('removes trailing ** and matches', () => {
    expect(matchesScope('src/domain/entity.ts', 'src/domain/**')).toBe(true);
  });
});

describe('collectEdges', () => {
  it('collects all dependency edges', () => {
    const nodes = makeNodes({
      'src/a.ts': ['src/b.ts'],
      'src/b.ts': ['src/c.ts'],
      'src/c.ts': [],
    });

    const edges = collectEdges(nodes, undefined);

    expect(edges).toHaveLength(2);
  });

  it('filters by scope', () => {
    const nodes = makeNodes({
      'src/domain/a.ts': ['src/infra/b.ts'],
      'src/infra/b.ts': [],
    });

    const edges = collectEdges(nodes, 'src/domain');

    expect(edges).toHaveLength(0);
  });
});

describe('collectLayerEdges', () => {
  const layerDefs: LayerDef[] = [
    { name: 'domain', path: 'src/domain/**/*.ts' },
    { name: 'application', path: 'src/app/**/*.ts', canImport: ['domain'] },
    { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain', 'application'] },
  ];

  it('aggregates file dependencies into inter-layer edges', () => {
    const nodes = makeNodes({
      'src/app/service.ts': ['src/domain/entity.ts'],
      'src/domain/entity.ts': [],
      'src/infra/repo.ts': ['src/domain/entity.ts'],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(2);
    const appToDomain = edges.find((e) => e.from === 'application' && e.to === 'domain');
    const infraToDomain = edges.find((e) => e.from === 'infra' && e.to === 'domain');
    expect(appToDomain?.allowed).toBe(true);
    expect(appToDomain?.count).toBe(1);
    expect(infraToDomain?.allowed).toBe(true);
  });

  it('marks dependencies not in canImport as violations', () => {
    const nodes = makeNodes({
      'src/domain/entity.ts': ['src/infra/repo.ts'],
      'src/infra/repo.ts': [],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('domain');
    expect(edges[0].to).toBe('infra');
    expect(edges[0].allowed).toBe(false);
  });

  it('ignores dependencies of files not belonging to any layer', () => {
    const nodes = makeNodes({
      'lib/external.ts': ['src/domain/entity.ts'],
      'src/domain/entity.ts': [],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(0);
  });

  it('dependencies from layers without canImport to other layers are violations', () => {
    const defsNoCan: LayerDef[] = [
      { name: 'domain', path: 'src/domain/**/*.ts' },
      { name: 'orphan', path: 'src/orphan/**/*.ts' },
    ];
    const nodes = makeNodes({
      'src/orphan/a.ts': ['src/domain/b.ts'],
      'src/domain/b.ts': [],
    });

    const edges = collectLayerEdges(defsNoCan, nodes);

    expect(edges).toHaveLength(1);
    expect(edges[0].allowed).toBe(false);
  });

  it('ignores intra-layer dependencies', () => {
    const nodes = makeNodes({
      'src/domain/entity.ts': ['src/domain/value-object.ts'],
      'src/domain/value-object.ts': [],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(0);
  });

  it('merges dependencies of multiple files into a single edge count', () => {
    const nodes = makeNodes({
      'src/app/service-a.ts': ['src/domain/entity.ts'],
      'src/app/service-b.ts': ['src/domain/entity.ts'],
      'src/domain/entity.ts': [],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(1);
    expect(edges[0].count).toBe(2);
  });
});

describe('formatMermaid', () => {
  it('generates Mermaid graph TD format', () => {
    const edges = [{ from: 'a.ts', to: 'b.ts' }];
    const result = formatMermaid(edges);

    expect(result).toContain('graph TD');
    expect(result).toContain('"a.ts" --> "b.ts"');
  });
});

describe('formatDot', () => {
  it('generates DOT digraph format', () => {
    const edges = [{ from: 'a.ts', to: 'b.ts' }];
    const result = formatDot(edges);

    expect(result).toContain('digraph dependencies');
    expect(result).toContain('"a.ts" -> "b.ts"');
  });
});

describe('formatLayerMermaid', () => {
  const layerDefs: LayerDef[] = [
    { name: 'domain', path: 'src/domain/**' },
    { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
  ];

  it('outputs inter-layer dependencies in Mermaid format', () => {
    const edges = [{ from: 'infra', to: 'domain', count: 3, allowed: true }];
    const result = formatLayerMermaid(layerDefs, edges);

    expect(result).toContain('graph TD');
    expect(result).toContain('infra -->|3| domain');
  });

  it('outputs disconnected layers as independent nodes', () => {
    const defs: LayerDef[] = [
      { name: 'domain', path: 'src/domain/**' },
      { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
      { name: 'isolated', path: 'src/isolated/**' },
    ];
    const edges = [{ from: 'infra', to: 'domain', count: 1, allowed: true }];
    const result = formatLayerMermaid(defs, edges);

    expect(result).toContain('  isolated');
    expect(result).not.toContain('isolated -->');
    expect(result).not.toContain('--> isolated');
  });

  it('displays violations as dashed lines', () => {
    const edges = [{ from: 'domain', to: 'infra', count: 1, allowed: false }];
    const result = formatLayerMermaid(layerDefs, edges);

    expect(result).toContain('-.->');
    expect(result).toContain('violation');
  });
});

describe('buildGraphApiResponse', () => {
  it('returns nodes and edges without layers', () => {
    const nodes = makeNodes({
      'src/a.ts': ['src/b.ts'],
      'src/b.ts': [],
    });

    const result = buildGraphApiResponse(nodes, undefined, null);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.layers).toHaveLength(0);
    expect(result.edges[0]).toStrictEqual({
      source: 'src/a.ts',
      target: 'src/b.ts',
      allowed: true,
    });
  });

  it('returns nodes and edges with layer info', () => {
    const layerDefs: LayerDef[] = [
      { name: 'domain', path: 'src/domain/**/*.ts' },
      { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
    ];
    const nodes = makeNodes({
      'src/domain/entity.ts': [],
      'src/infra/repo.ts': ['src/domain/entity.ts'],
    });

    const result = buildGraphApiResponse(nodes, undefined, layerDefs);

    expect(result.nodes).toHaveLength(2);
    const domainNode = result.nodes.find((n) => n.id === 'src/domain/entity.ts');
    const infraNode = result.nodes.find((n) => n.id === 'src/infra/repo.ts');
    expect(domainNode?.layer).toBe('domain');
    expect(infraNode?.layer).toBe('infra');
    expect(result.edges[0].allowed).toBe(true);
    expect(result.layers).toHaveLength(2);
  });

  it('marks unauthorized dependencies as violations', () => {
    const layerDefs: LayerDef[] = [
      { name: 'domain', path: 'src/domain/**/*.ts' },
      { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
    ];
    const nodes = makeNodes({
      'src/domain/entity.ts': ['src/infra/repo.ts'],
      'src/infra/repo.ts': [],
    });

    const result = buildGraphApiResponse(nodes, undefined, layerDefs);

    expect(result.edges[0].allowed).toBe(false);
  });

  it('filters by scope', () => {
    const nodes = makeNodes({
      'src/domain/a.ts': ['src/infra/b.ts'],
      'src/infra/b.ts': [],
    });

    const result = buildGraphApiResponse(nodes, 'src/domain', null);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('node size reflects dependency count', () => {
    const nodes = makeNodes({
      'src/a.ts': ['src/b.ts', 'src/c.ts'],
      'src/b.ts': [],
      'src/c.ts': [],
    });

    const result = buildGraphApiResponse(nodes, undefined, null);
    const nodeA = result.nodes.find((n) => n.id === 'src/a.ts');

    expect(nodeA?.size).toBe(2);
  });

  it('calculates file count per layer', () => {
    const layerDefs: LayerDef[] = [
      { name: 'domain', path: 'src/domain/**/*.ts' },
      { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
    ];
    const nodes = makeNodes({
      'src/domain/a.ts': [],
      'src/domain/b.ts': [],
      'src/infra/c.ts': [],
    });

    const result = buildGraphApiResponse(nodes, undefined, layerDefs);

    const domainLayer = result.layers.find((l) => l.name === 'domain');
    const infraLayer = result.layers.find((l) => l.name === 'infra');
    expect(domainLayer?.fileCount).toBe(2);
    expect(infraLayer?.fileCount).toBe(1);
  });

  it('marks intra-layer edges as allowed', () => {
    const layerDefs: LayerDef[] = [{ name: 'domain', path: 'src/domain/**/*.ts' }];
    const nodes = makeNodes({
      'src/domain/a.ts': ['src/domain/b.ts'],
      'src/domain/b.ts': [],
    });

    const result = buildGraphApiResponse(nodes, undefined, layerDefs);

    expect(result.edges[0].allowed).toBe(true);
  });
});

describe('formatLayerDot', () => {
  const layerDefs: LayerDef[] = [
    { name: 'domain', path: 'src/domain/**' },
    { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
  ];

  it('outputs layer graph in DOT format', () => {
    const edges = [{ from: 'infra', to: 'domain', count: 3, allowed: true }];
    const result = formatLayerDot(layerDefs, edges);

    expect(result).toContain('digraph architecture');
    expect(result).toContain('"infra" -> "domain"');
  });

  it('displays violations as red dashed lines', () => {
    const edges = [{ from: 'domain', to: 'infra', count: 1, allowed: false }];
    const result = formatLayerDot(layerDefs, edges);

    expect(result).toContain('style=dashed');
    expect(result).toContain('color=red');
    expect(result).toContain('violation');
  });
});
