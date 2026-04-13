import { describe, it, expect, vi } from 'vitest';
import type { ModuleNode } from '@retemper/lodestar-types';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noCircular, estimateChainLength } from './no-circular.rule';
import { matchGlob } from '../../shared/match-glob';

/** Creates a cyclic graph: a->b->a */
function cyclicGraph(): Map<string, ModuleNode> {
  return new Map([
    ['src/a.ts', { id: 'src/a.ts', dependencies: ['src/b.ts'], dependents: ['src/b.ts'] }],
    ['src/b.ts', { id: 'src/b.ts', dependencies: ['src/a.ts'], dependents: ['src/a.ts'] }],
    ['src/c.ts', { id: 'src/c.ts', dependencies: [], dependents: [] }],
  ]);
}

describe('architecture/no-circular', () => {
  it('does not report violations when there are no cycles', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: [] }],
      ['b.ts', { id: 'b.ts', dependencies: [], dependents: ['a.ts'] }],
    ]);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(false),
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('reports violations when there are cycles', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: ['b.ts'] }],
      ['b.ts', { id: 'b.ts', dependencies: ['a.ts'], dependents: ['a.ts'] }],
    ]);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(2);
  });

  it('filters check targets with entries option', async () => {
    const nodes = cyclicGraph();
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ entries: ['src/a.ts'] }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(1);
    expect(violations[0].location?.file).toBe('src/a.ts');
  });

  it('supports glob patterns in entries', async () => {
    const nodes = cyclicGraph();
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ entries: ['src/a.*'] }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(1);
  });

  it('excludes files matching ignore patterns', async () => {
    const nodes = cyclicGraph();
    const hasCircular = vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve(id !== 'src/c.ts'));
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular,
    });
    const { ctx, violations } = createTestContext({ ignore: ['src/b.*'] }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(1);
    expect(violations[0].location?.file).toBe('src/a.ts');
  });

  it('respects maxDepth option', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: ['b.ts'] }],
      ['b.ts', { id: 'b.ts', dependencies: ['a.ts'], dependents: ['a.ts'] }],
    ]);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ maxDepth: 1 }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('reports cycles within maxDepth as violations', async () => {
    const nodes = new Map([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: ['b.ts'] }],
      ['b.ts', { id: 'b.ts', dependencies: ['a.ts'], dependents: ['a.ts'] }],
    ]);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ maxDepth: 5 }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(2);
  });

  it('uses entries and ignore simultaneously', async () => {
    const nodes = cyclicGraph();
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext(
      { entries: ['src/**'], ignore: ['src/c.*'] },
      providers,
    );

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(2);
  });

  it('has correct rule metadata', () => {
    expect(noCircular.name).toBe('architecture/no-circular');
    expect(noCircular.needs).toStrictEqual(['graph']);
  });
});

describe('matchGlob', () => {
  it('matches exact paths', () => {
    expect(matchGlob('src/a.ts', 'src/a.ts')).toBe(true);
    expect(matchGlob('src/a.ts', 'src/b.ts')).toBe(false);
  });

  it('matches * wildcard', () => {
    expect(matchGlob('src/a.ts', 'src/*.ts')).toBe(true);
    expect(matchGlob('src/deep/a.ts', 'src/*.ts')).toBe(false);
  });

  it('matches ** globstar', () => {
    expect(matchGlob('src/deep/nested/a.ts', 'src/**/*.ts')).toBe(true);
    expect(matchGlob('lib/a.ts', 'src/**/*.ts')).toBe(false);
  });
});

describe('estimateChainLength', () => {
  it('correctly calculates length of A→B→A cycle', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b'] }],
      ['b', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });

  it('returns Infinity when there are no cycles', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b'] }],
      ['b', { dependencies: [] as string[] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(Infinity);
  });

  it('skips already visited nodes in BFS', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b', 'c'] }],
      ['b', { dependencies: ['c'] }],
      ['c', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });

  it('skips dependency nodes that do not exist in the graph', () => {
    const nodes = new Map([
      ['a', { dependencies: ['missing', 'b'] }],
      ['b', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });
});
