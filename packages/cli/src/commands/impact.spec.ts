import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@retemper/lodestar-core', () => ({
  createProviders: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  })),
}));

import { collectTransitiveDependents, impactCommand } from './impact';
import { createProviders } from '@retemper/lodestar-core';

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
  it('returns direct dependents at depth 1', () => {
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

  it('returns indirect dependents at depth 2+ and records via', () => {
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

  it('explores only up to the specified maxDepth', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': ['d.ts'],
      'd.ts': [],
    });

    const result = collectTransitiveDependents('a.ts', nodes, 1);

    expect(result).toStrictEqual([{ file: 'b.ts', depth: 1, via: null }]);
  });

  it('handles circular dependencies without infinite loop', () => {
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

  it('returns empty array when targeting a file not in the graph', () => {
    const nodes = makeNodes({ 'a.ts': ['b.ts'] });

    const result = collectTransitiveDependents('unknown.ts', nodes, undefined);

    expect(result).toStrictEqual([]);
  });

  it('returns empty array when there are no dependents', () => {
    const nodes = makeNodes({ 'a.ts': [] });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([]);
  });

  it('includes in results even when dependents point to nodes not in the graph', () => {
    const nodes = makeNodes({
      'a.ts': ['b.ts'],
    });

    const result = collectTransitiveDependents('a.ts', nodes, undefined);

    expect(result).toStrictEqual([{ file: 'b.ts', depth: 1, via: null }]);
  });

  it('does not visit already visited nodes again', () => {
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

  it('outputs error message and sets exitCode to 1 when file is not in the module graph', async () => {
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

  it('outputs human-readable output to stderr when json option is absent', async () => {
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

  it('outputs JSON to stdout when json option is true', async () => {
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

  it('passes depth option to collectTransitiveDependents', async () => {
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

  it('includes via info in human output when transitive dependents exist', async () => {
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

  it('does not output Transitive section when there are no transitive dependents', async () => {
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

  it('includes via info for transitive dependents in JSON output', async () => {
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
