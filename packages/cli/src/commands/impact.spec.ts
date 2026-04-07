import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@retemper/lodestar', () => ({
  createProviders: vi.fn(),
}));

import { collectTransitiveDependents, impactCommand } from './impact';
import { createProviders } from '@retemper/lodestar';

const mockCreateProviders = vi.mocked(createProviders);

/** Creates a node map for testing */
function makeNodes(
  defs: Record<string, string[]>,
): ReadonlyMap<string, { readonly dependents: readonly string[] }> {
  const nodes = new Map<string, { readonly dependents: readonly string[] }>();
  for (const [id, deps] of Object.entries(defs)) {
    nodes.set(id, { dependents: deps });
  }
  return nodes;
}

describe('collectTransitiveDependents', () => {
  it('직접 의존자를 depth 1로 반환한다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts', 'c.ts'],
      'b.ts': [],
      'c.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([
      { file: 'b.ts', depth: 1, via: null },
      { file: 'c.ts', depth: 1, via: null },
    ]);
  });

  it('간접 의존자를 depth 2 이상으로 반환하며 via를 기록한다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([
      { file: 'b.ts', depth: 1, via: null },
      { file: 'c.ts', depth: 2, via: 'b.ts' },
    ]);
  });

  it('maxDepth를 지정하면 해당 깊이까지만 탐색한다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': ['d.ts'],
      'd.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, 1);

    expect(result).toStrictEqual([{ file: 'b.ts', depth: 1, via: null }]);
  });

  it('순환 의존성이 있어도 무한 루프 없이 처리한다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts', 'c.ts'],
      'c.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([
      { file: 'b.ts', depth: 1, via: null },
      { file: 'c.ts', depth: 2, via: 'b.ts' },
    ]);
  });

  it('그래프에 없는 파일을 대상으로 하면 빈 배열을 반환한다', () => {
    const nodes = makeNodes({ 'a.ts': ['b.ts'] });

    const result = collectTransitiveDependents('unknown.ts', nodes, undefined);

    expect(result).toStrictEqual([]);
  });

  it('의존자가 없으면 빈 배열을 반환한다', () => {
    const nodes = makeNodes({ 'a.ts': [] });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([]);
  });

  it('의존자가 그래프에 존재하지 않는 노드를 가리켜도 결과에 포함한다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([{ file: 'b.ts', depth: 1, via: null }]);
  });

  it('이미 방문한 노드는 중복 방문하지 않는다', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts', 'c.ts'],
      'b.ts': ['d.ts'],
      'c.ts': ['d.ts'],
      'd.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    const dFiles = result.filter((e) => e.file === 'd.ts');
    expect(dFiles).toHaveLength(1);
  });
});

describe('impactCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('모듈 그래프에 파일이 없으면 에러 메시지를 출력하고 exitCode를 1로 설정한다', async () => {
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({
          nodes: new Map(),
        }),
      },
    } as never);

    await impactCommand({ _: ['impact'], $0: 'lodestar', file: 'missing.ts' });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    expect(process.exitCode).toBe(1);
  });

  it('json 옵션이 없으면 human-readable 출력을 stderr에 표시한다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['dep.ts'], dependencies: [] }],
      ['dep.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({ _: ['impact'], $0: 'lodestar', file: 'target.ts' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Impact analysis'))).toBe(true);
    expect(calls.some((c) => c.includes('Direct dependents'))).toBe(true);
    expect(calls.some((c) => c.includes('Total:'))).toBe(true);
  });

  it('json 옵션이 true이면 JSON을 stdout에 출력한다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['dep.ts'], dependencies: [] }],
      ['dep.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({ _: ['impact'], $0: 'lodestar', file: 'target.ts', json: true });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.target).toBe('target.ts');
    expect(parsed.directDependents).toStrictEqual(['dep.ts']);
    expect(parsed.totalAffected).toBe(1);
  });

  it('depth 옵션을 collectTransitiveDependents에 전달한다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['a.ts'], dependencies: [] }],
      ['a.ts', { dependents: ['b.ts'], dependencies: [] }],
      ['b.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({
      _: ['impact'],
      $0: 'lodestar',
      file: 'target.ts',
      json: true,
      depth: 1,
    });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.directDependents).toStrictEqual(['a.ts']);
    expect(parsed.transitiveDependents).toStrictEqual([]);
  });

  it('transitive 의존자가 있으면 human 출력에 via 정보를 포함한다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['a.ts'], dependencies: [] }],
      ['a.ts', { dependents: ['b.ts'], dependencies: [] }],
      ['b.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({ _: ['impact'], $0: 'lodestar', file: 'target.ts' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Transitive dependents'))).toBe(true);
    expect(calls.some((c) => c.includes('via a.ts'))).toBe(true);
  });

  it('transitive 의존자가 없으면 Transitive 섹션을 출력하지 않는다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['a.ts'], dependencies: [] }],
      ['a.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({ _: ['impact'], $0: 'lodestar', file: 'target.ts' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Transitive dependents'))).toBe(false);
  });

  it('JSON 출력에서 transitive 의존자의 via 정보를 포함한다', async () => {
    const nodes = new Map([
      ['target.ts', { dependents: ['a.ts'], dependencies: [] }],
      ['a.ts', { dependents: ['b.ts'], dependencies: [] }],
      ['b.ts', { dependents: [], dependencies: [] }],
    ]);
    mockCreateProviders.mockReturnValue({
      graph: {
        getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      },
    } as never);

    await impactCommand({
      _: ['impact'],
      $0: 'lodestar',
      file: 'target.ts',
      json: true,
    });

    const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.transitiveDependents).toStrictEqual([{ file: 'b.ts', via: 'a.ts' }]);
  });
});
