import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { noCircularPackages, detectCycles } from './no-circular-packages.rule';

describe('architecture/no-circular-packages', () => {
  it('비순환 패키지 그래프에서 위반이 없다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json', 'packages/types/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@app/core', dependencies: { '@app/types': 'workspace:*' } })
      .mockResolvedValueOnce({ name: '@app/types', dependencies: {} });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('두 패키지 간 순환 의존성을 감지한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/a/package.json', 'packages/b/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@app/a', dependencies: { '@app/b': 'workspace:*' } })
      .mockResolvedValueOnce({ name: '@app/b', dependencies: { '@app/a': 'workspace:*' } });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('@app/a');
    expect(violations[0].message).toContain('@app/b');
  });

  it('3자 순환 의존성을 감지한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce([
        'packages/a/package.json',
        'packages/b/package.json',
        'packages/c/package.json',
      ])
      .mockResolvedValueOnce([]);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@app/a', dependencies: { '@app/b': '*' } })
      .mockResolvedValueOnce({ name: '@app/b', dependencies: { '@app/c': '*' } })
      .mockResolvedValueOnce({ name: '@app/c', dependencies: { '@app/a': '*' } });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('→');
  });

  it('외부(비워크스페이스) 의존성은 무시한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi.fn().mockResolvedValueOnce({
      name: '@app/core',
      dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
    });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('의존성이 없는 패키지를 처리한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/types/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi.fn().mockResolvedValueOnce({ name: '@app/types' });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('packages/와 plugins/ 디렉토리를 모두 스캔한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json'])
      .mockResolvedValueOnce(['plugins/my-plugin/package.json']);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@app/core', dependencies: { '@app/my-plugin': '*' } })
      .mockResolvedValueOnce({ name: '@app/my-plugin', dependencies: { '@app/core': '*' } });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations.length).toBeGreaterThan(0);
  });

  it('@ 접두사만 있고 / 가 없는 패키지명은 스코프로 인식하지 않는다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@noslash', dependencies: {} });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('스코프가 없는 패키지만 있으면 검사를 건너뛴다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi.fn().mockResolvedValueOnce({ name: 'core', dependencies: { utils: '*' } });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('name이 없는 package.json은 건너뛴다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/nameless/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi.fn().mockResolvedValueOnce({ dependencies: {} });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('scope 옵션이 주어지면 자동 감지 대신 해당 scope를 사용한다', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/a/package.json', 'packages/b/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi
      .fn()
      .mockResolvedValueOnce({ name: '@custom/a', dependencies: { '@custom/b': '*' } })
      .mockResolvedValueOnce({ name: '@custom/b', dependencies: { '@custom/a': '*' } });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      { scope: '@custom' },
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations.length).toBeGreaterThan(0);
  });

  it('패키지 디렉토리가 하나도 없으면 조기 반환한다', async () => {
    const glob = vi.fn().mockResolvedValue([]);
    const providers = createMockProviders({ glob });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('올바른 규칙 메타데이터를 가진다', () => {
    expect(noCircularPackages.name).toBe('architecture/no-circular-packages');
    expect(noCircularPackages.needs).toStrictEqual(['fs', 'config']);
  });
});

describe('detectCycles', () => {
  it('A→B→A 순환을 찾는다', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('비순환 그래프에서 빈 배열을 반환한다', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', [] as string[]],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('그래프에 없는 의존성 노드를 건너뛴다', () => {
    const graph = new Map([
      ['A', ['B', 'missing']],
      ['B', [] as string[]],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('의존성이 없는 노드만 있으면 빈 배열을 반환한다', () => {
    const graph = new Map([['A', [] as string[]]]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('큰 그래프에서 순환을 찾는다', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
      ['D', [] as string[]],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
