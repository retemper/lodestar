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
  it('순환이 없으면 위반을 보고하지 않는다', async () => {
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

  it('순환이 있으면 위반을 보고한다', async () => {
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

  it('entries 옵션으로 검사 대상을 필터링한다', async () => {
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

  it('entries에 glob 패턴을 지원한다', async () => {
    const nodes = cyclicGraph();
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ entries: ['src/a.*'] }, providers);

    await noCircular.check(ctx as never);

    expect(violations).toHaveLength(1);
  });

  it('ignore 패턴에 매칭되는 파일은 제외한다', async () => {
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

  it('maxDepth 옵션을 준수한다', async () => {
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

  it('maxDepth 이하의 순환은 위반으로 보고한다', async () => {
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

  it('entries와 ignore를 동시에 사용한다', async () => {
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

  it('올바른 규칙 메타데이터를 가진다', () => {
    expect(noCircular.name).toBe('architecture/no-circular');
    expect(noCircular.needs).toStrictEqual(['graph']);
  });
});

describe('matchGlob', () => {
  it('정확한 경로를 매칭한다', () => {
    expect(matchGlob('src/a.ts', 'src/a.ts')).toBe(true);
    expect(matchGlob('src/a.ts', 'src/b.ts')).toBe(false);
  });

  it('* 와일드카드를 매칭한다', () => {
    expect(matchGlob('src/a.ts', 'src/*.ts')).toBe(true);
    expect(matchGlob('src/deep/a.ts', 'src/*.ts')).toBe(false);
  });

  it('** 글로브스타를 매칭한다', () => {
    expect(matchGlob('src/deep/nested/a.ts', 'src/**/*.ts')).toBe(true);
    expect(matchGlob('lib/a.ts', 'src/**/*.ts')).toBe(false);
  });
});

describe('estimateChainLength', () => {
  it('A→B→A 순환의 길이를 올바르게 계산한다', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b'] }],
      ['b', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });

  it('순환이 없으면 Infinity를 반환한다', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b'] }],
      ['b', { dependencies: [] as string[] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(Infinity);
  });

  it('BFS에서 이미 방문한 노드를 건너뛴다', () => {
    const nodes = new Map([
      ['a', { dependencies: ['b', 'c'] }],
      ['b', { dependencies: ['c'] }],
      ['c', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });

  it('그래프에 존재하지 않는 의존성 노드를 건너뛴다', () => {
    const nodes = new Map([
      ['a', { dependencies: ['missing', 'b'] }],
      ['b', { dependencies: ['a'] }],
    ]);
    expect(estimateChainLength(nodes, 'a')).toBe(2);
  });
});
