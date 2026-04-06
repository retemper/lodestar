import { describe, it, expect } from 'vitest';
import type { ModuleNode } from 'lodestar';
import {
  collectEdges,
  collectLayerEdges,
  formatMermaid,
  formatDot,
  formatLayerMermaid,
  formatLayerDot,
  matchesScope,
} from './graph';
import type { LayerDef } from './graph';

/** 테스트용 모듈 그래프 생성 */
function makeNodes(defs: Record<string, string[]>): ReadonlyMap<string, ModuleNode> {
  const nodes = new Map<string, ModuleNode>();
  for (const [id, deps] of Object.entries(defs)) {
    nodes.set(id, { id, dependencies: deps, dependents: [] });
  }
  return nodes;
}

describe('matchesScope', () => {
  it('prefix가 일치하면 true를 반환한다', () => {
    expect(matchesScope('src/domain/entity.ts', 'src/domain')).toBe(true);
  });

  it('prefix가 불일치하면 false를 반환한다', () => {
    expect(matchesScope('src/infra/repo.ts', 'src/domain')).toBe(false);
  });

  it('trailing **를 제거하고 매칭한다', () => {
    expect(matchesScope('src/domain/entity.ts', 'src/domain/**')).toBe(true);
  });
});

describe('collectEdges', () => {
  it('모든 의존성 edge를 수집한다', () => {
    const nodes = makeNodes({
      'src/a.ts': ['src/b.ts'],
      'src/b.ts': ['src/c.ts'],
      'src/c.ts': [],
    });

    const edges = collectEdges(nodes, undefined);

    expect(edges).toHaveLength(2);
  });

  it('scope로 필터링한다', () => {
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

  it('파일 의존성을 레이어 간 edge로 집계한다', () => {
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

  it('canImport에 없는 의존성을 violation으로 표시한다', () => {
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

  it('같은 레이어 내 의존성은 무시한다', () => {
    const nodes = makeNodes({
      'src/domain/entity.ts': ['src/domain/value-object.ts'],
      'src/domain/value-object.ts': [],
    });

    const edges = collectLayerEdges(layerDefs, nodes);

    expect(edges).toHaveLength(0);
  });

  it('여러 파일의 의존성을 하나의 edge 카운트로 합친다', () => {
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
  it('Mermaid graph TD 형식을 생성한다', () => {
    const edges = [{ from: 'a.ts', to: 'b.ts' }];
    const result = formatMermaid(edges);

    expect(result).toContain('graph TD');
    expect(result).toContain('"a.ts" --> "b.ts"');
  });
});

describe('formatDot', () => {
  it('DOT digraph 형식을 생성한다', () => {
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

  it('레이어 간 의존성을 Mermaid로 출력한다', () => {
    const edges = [{ from: 'infra', to: 'domain', count: 3, allowed: true }];
    const result = formatLayerMermaid(layerDefs, edges);

    expect(result).toContain('graph TD');
    expect(result).toContain('infra -->|3| domain');
  });

  it('위반을 점선으로 표시한다', () => {
    const edges = [{ from: 'domain', to: 'infra', count: 1, allowed: false }];
    const result = formatLayerMermaid(layerDefs, edges);

    expect(result).toContain('-.->');
    expect(result).toContain('violation');
  });
});

describe('formatLayerDot', () => {
  const layerDefs: LayerDef[] = [
    { name: 'domain', path: 'src/domain/**' },
    { name: 'infra', path: 'src/infra/**', canImport: ['domain'] },
  ];

  it('레이어 그래프를 DOT로 출력한다', () => {
    const edges = [{ from: 'infra', to: 'domain', count: 3, allowed: true }];
    const result = formatLayerDot(layerDefs, edges);

    expect(result).toContain('digraph architecture');
    expect(result).toContain('"infra" -> "domain"');
  });

  it('위반을 빨간 점선으로 표시한다', () => {
    const edges = [{ from: 'domain', to: 'infra', count: 1, allowed: false }];
    const result = formatLayerDot(layerDefs, edges);

    expect(result).toContain('style=dashed');
    expect(result).toContain('color=red');
    expect(result).toContain('violation');
  });
});
