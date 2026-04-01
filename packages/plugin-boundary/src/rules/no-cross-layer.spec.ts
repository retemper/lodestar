import { describe, it, expect, vi } from 'vitest';
import type { RuleContext, RuleProviders, Violation } from '@lodestar/types';
import { noCrossLayer } from './no-cross-layer.js';

/** Create mock providers for testing */
function createMockProviders(
  overrides: {
    glob?: ReturnType<typeof vi.fn>;
    getImports?: ReturnType<typeof vi.fn>;
  } = {},
): RuleProviders {
  return {
    fs: {
      glob: overrides.glob ?? vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({}),
    },
    graph: {
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
      hasCircular: vi.fn().mockResolvedValue(false),
      getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
    },
    ast: {
      getSourceFile: vi.fn().mockResolvedValue(null),
      getImports: overrides.getImports ?? vi.fn().mockResolvedValue([]),
      getExports: vi.fn().mockResolvedValue([]),
    },
    config: {
      getPackageJson: vi.fn().mockResolvedValue({}),
      getTsConfig: vi.fn().mockResolvedValue({}),
      getCustomConfig: vi.fn().mockResolvedValue({}),
    },
  };
}

/** Create a test RuleContext and a violations collection array */
function createTestContext(
  options: Record<string, unknown>,
  providers: RuleProviders,
): { ctx: RuleContext; violations: Violation[] } {
  const violations: Violation[] = [];
  const ctx: RuleContext = {
    rootDir: '/test',
    options,
    providers,
    report(partial) {
      violations.push({
        ruleId: 'boundary/no-cross-layer',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  return { ctx, violations };
}

describe('boundary/no-cross-layer', () => {
  it('reports a violation when a lower layer imports from an upper layer', async () => {
    const layers = ['universal', 'web/service', 'web/entry'];
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['universal/utils.ts'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const getImports = vi.fn().mockResolvedValueOnce([
      {
        source: 'web/service/api',
        specifiers: [],
        isTypeOnly: false,
        location: { file: 'universal/utils.ts', line: 1 },
      },
    ]);

    const providers = createMockProviders({ glob, getImports });
    const { ctx, violations } = createTestContext({ layers }, providers);

    await noCrossLayer.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('universal');
    expect(violations[0].message).toContain('web/service');
  });

  it('does not report a violation when an upper layer imports from a lower layer', async () => {
    const layers = ['universal', 'web/service', 'web/entry'];
    const glob = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['web/service/api.ts'])
      .mockResolvedValueOnce([]);
    const getImports = vi.fn().mockResolvedValueOnce([
      {
        source: 'universal/helpers',
        specifiers: [],
        isTypeOnly: false,
        location: { file: 'web/service/api.ts', line: 1 },
      },
    ]);

    const providers = createMockProviders({ glob, getImports });
    const { ctx, violations } = createTestContext({ layers }, providers);

    await noCrossLayer.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('does not report a violation for imports within the same layer', async () => {
    const layers = ['universal', 'web/service'];
    const glob = vi.fn().mockResolvedValueOnce(['universal/a.ts']).mockResolvedValueOnce([]);
    const getImports = vi.fn().mockResolvedValueOnce([
      {
        source: 'universal/b',
        specifiers: [],
        isTypeOnly: false,
        location: { file: 'universal/a.ts', line: 1 },
      },
    ]);

    const providers = createMockProviders({ glob, getImports });
    const { ctx, violations } = createTestContext({ layers }, providers);

    await noCrossLayer.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports no violations when the layer list is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext({ layers: [] }, providers);

    await noCrossLayer.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('does not include external package imports in layer checks', async () => {
    const layers = ['universal', 'web/service'];
    const glob = vi.fn().mockResolvedValueOnce(['universal/a.ts']).mockResolvedValueOnce([]);
    const getImports = vi.fn().mockResolvedValueOnce([
      {
        source: 'react',
        specifiers: [],
        isTypeOnly: false,
        location: { file: 'universal/a.ts', line: 1 },
      },
    ]);

    const providers = createMockProviders({ glob, getImports });
    const { ctx, violations } = createTestContext({ layers }, providers);

    await noCrossLayer.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('has correct rule metadata', () => {
    expect(noCrossLayer.name).toBe('boundary/no-cross-layer');
    expect(noCrossLayer.needs).toStrictEqual(['ast', 'fs']);
  });
});
