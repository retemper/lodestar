import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noCircularPackages, detectCycles } from './no-circular-packages.rule';

describe('architecture/no-circular-packages', () => {
  it('no violation in acyclic package graph', async () => {
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

  it('detects circular dependency between two packages', async () => {
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

  it('detects 3-node circular dependency', async () => {
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

  it('ignores external (non-workspace) dependencies', async () => {
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

  it('handles packages without dependencies', async () => {
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

  it('scans both packages/ and plugins/ directories', async () => {
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

  it('does not recognize package name with @ prefix but no / as scoped', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['packages/core/package.json'])
      .mockResolvedValueOnce([]);
    const readJson = vi.fn().mockResolvedValueOnce({ name: '@noslash', dependencies: {} });
    const providers = createMockProviders({ glob, readJson });
    const { ctx, violations } = createTestContext(
      {},
      providers,
      'architecture/no-circular-packages',
    );

    await noCircularPackages.check(ctx as never);

    expect(violations).toHaveLength(0);
  });

  it('skips checks when there are only packages without scope', async () => {
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

  it('skips package.json without name', async () => {
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

  it('uses given scope instead of auto-detection when scope option is provided', async () => {
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

  it('returns early when no package directories exist', async () => {
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

  it('has correct rule metadata', () => {
    expect(noCircularPackages.name).toBe('architecture/no-circular-packages');
    expect(noCircularPackages.needs).toStrictEqual(['fs', 'config']);
  });
});

describe('detectCycles', () => {
  it('finds A→B→A cycle', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns empty array for acyclic graph', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', [] as string[]],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('skips dependency nodes not in the graph', () => {
    const graph = new Map([
      ['A', ['B', 'missing']],
      ['B', [] as string[]],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('returns empty array when only nodes without dependencies exist', () => {
    const graph = new Map([['A', [] as string[]]]);
    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('finds cycles in large graph', () => {
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
