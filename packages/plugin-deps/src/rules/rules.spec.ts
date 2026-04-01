import { describe, it, expect, vi } from 'vitest';
import type { RuleContext, RuleProviders, Violation, ModuleNode } from '@lodestar/types';
import { noCircular } from './no-circular.js';
import { noRestricted } from './no-restricted.js';
import { dependencyDirection } from './dependency-direction.js';

/** Create mock providers for testing */
function createMockProviders(
  overrides: {
    glob?: ReturnType<typeof vi.fn>;
    getImports?: ReturnType<typeof vi.fn>;
    getModuleGraph?: ReturnType<typeof vi.fn>;
    hasCircular?: ReturnType<typeof vi.fn>;
    getDependencies?: ReturnType<typeof vi.fn>;
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
      getDependencies: overrides.getDependencies ?? vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
      hasCircular: overrides.hasCircular ?? vi.fn().mockResolvedValue(false),
      getModuleGraph: overrides.getModuleGraph ?? vi.fn().mockResolvedValue({ nodes: new Map() }),
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

/** Create a test RuleContext and collect violations into a returned array */
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
        ruleId: 'test',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  return { ctx, violations };
}

describe('deps/no-circular', () => {
  it('reports no violations when there are no circular dependencies', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: [] }],
      ['b.ts', { id: 'b.ts', dependencies: [], dependents: ['a.ts'] }],
    ]);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular: vi.fn().mockResolvedValue(false),
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports violations when circular dependencies exist', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: ['b.ts'] }],
      ['b.ts', { id: 'b.ts', dependencies: ['a.ts'], dependents: ['a.ts'] }],
    ]);
    const hasCircular = vi.fn().mockResolvedValue(true);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular,
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx);

    expect(violations).toHaveLength(2);
    expect(hasCircular).toHaveBeenCalledWith('a.ts');
    expect(hasCircular).toHaveBeenCalledWith('b.ts');
  });

  it('reports no violations when the graph is empty', async () => {
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('only reports violations for nodes that are part of a cycle', async () => {
    const nodes = new Map<string, ModuleNode>([
      ['a.ts', { id: 'a.ts', dependencies: ['b.ts'], dependents: ['b.ts'] }],
      ['b.ts', { id: 'b.ts', dependencies: ['a.ts'], dependents: ['a.ts'] }],
      ['c.ts', { id: 'c.ts', dependencies: [], dependents: [] }],
    ]);
    const hasCircular = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const providers = createMockProviders({
      getModuleGraph: vi.fn().mockResolvedValue({ nodes }),
      hasCircular,
    });
    const { ctx, violations } = createTestContext({}, providers);

    await noCircular.check(ctx);

    expect(violations).toHaveLength(2);
    expect(violations[0].message).toContain('a.ts');
    expect(violations[1].message).toContain('b.ts');
  });

  it('has correct rule metadata', () => {
    expect(noCircular.name).toBe('deps/no-circular');
    expect(noCircular.needs).toStrictEqual(['graph']);
  });
});

describe('deps/no-restricted', () => {
  it('reports no violations when no restricted imports are found', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi
        .fn()
        .mockResolvedValue([
          { source: 'react', specifiers: [], isTypeOnly: false, location: { file: 'src/app.ts' } },
        ]),
    });
    const { ctx, violations } = createTestContext(
      { restrictions: [{ from: 'src', to: 'internal', message: 'No internal imports' }] },
      providers,
    );

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports a violation with a custom message when a restricted import is found', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi.fn().mockResolvedValue([
        {
          source: '../internal/secret',
          specifiers: [],
          isTypeOnly: false,
          location: { file: 'src/app.ts', line: 3 },
        },
      ]),
    });
    const { ctx, violations } = createTestContext(
      { restrictions: [{ from: 'src', to: 'internal', message: 'No internal imports allowed' }] },
      providers,
    );

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toBe('No internal imports allowed');
  });

  it('uses a default message when no custom message is provided', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi.fn().mockResolvedValue([
        {
          source: '../forbidden/module',
          specifiers: [],
          isTypeOnly: false,
          location: { file: 'src/app.ts' },
        },
      ]),
    });
    const { ctx, violations } = createTestContext(
      { restrictions: [{ from: 'src', to: 'forbidden' }] },
      providers,
    );

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('src');
    expect(violations[0].message).toContain('forbidden');
  });

  it('reports no violations when the restriction list is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext({ restrictions: [] }, providers);

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('checks multiple restrictions independently', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['web/app.ts'])
      .mockResolvedValueOnce(['server/handler.ts']);
    const getImports = vi
      .fn()
      .mockResolvedValueOnce([
        {
          source: '../internal/x',
          specifiers: [],
          isTypeOnly: false,
          location: { file: 'web/app.ts' },
        },
      ])
      .mockResolvedValueOnce([
        {
          source: '../database/conn',
          specifiers: [],
          isTypeOnly: false,
          location: { file: 'server/handler.ts' },
        },
      ]);
    const providers = createMockProviders({ glob, getImports });
    const { ctx, violations } = createTestContext(
      {
        restrictions: [
          { from: 'web', to: 'internal' },
          { from: 'server', to: 'database' },
        ],
      },
      providers,
    );

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(2);
  });

  it('does not report a violation when the import source does not contain the restricted string', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi.fn().mockResolvedValue([
        {
          source: './utils/helper',
          specifiers: [],
          isTypeOnly: false,
          location: { file: 'src/app.ts' },
        },
        { source: 'lodash', specifiers: [], isTypeOnly: false, location: { file: 'src/app.ts' } },
      ]),
    });
    const { ctx, violations } = createTestContext(
      { restrictions: [{ from: 'src', to: 'secret' }] },
      providers,
    );

    await noRestricted.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('has correct rule metadata', () => {
    expect(noRestricted.name).toBe('deps/no-restricted');
    expect(noRestricted.needs).toStrictEqual(['ast', 'fs']);
  });
});

describe('deps/dependency-direction', () => {
  it('reports no violations when the layer direction is respected', async () => {
    const providers = createMockProviders({
      glob: vi
        .fn()
        .mockResolvedValueOnce(['src/domain/entity.ts'])
        .mockResolvedValueOnce(['src/application/service.ts']),
      getDependencies: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['src/domain/entity.ts']),
    });
    const { ctx, violations } = createTestContext(
      {
        layers: [
          { name: 'domain', pattern: 'src/domain/**/*.ts' },
          { name: 'application', pattern: 'src/application/**/*.ts' },
        ],
      },
      providers,
    );

    await dependencyDirection.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports a violation when a lower layer depends on an upper layer', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValueOnce(['src/domain/entity.ts']).mockResolvedValueOnce([]),
      getDependencies: vi.fn().mockResolvedValueOnce(['src/application/service.ts']),
    });
    const { ctx, violations } = createTestContext(
      {
        layers: [
          { name: 'domain', pattern: 'src/domain/**/*.ts' },
          { name: 'application', pattern: 'src/application/**/*.ts' },
        ],
      },
      providers,
    );

    await dependencyDirection.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('domain');
    expect(violations[0].message).toContain('application');
  });

  it('reports no violations when the layers list is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext({ layers: [] }, providers);

    await dependencyDirection.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('does not report a violation for dependencies within the same layer', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValueOnce(['src/domain/a.ts', 'src/domain/b.ts']),
      getDependencies: vi.fn().mockResolvedValueOnce(['src/domain/b.ts']).mockResolvedValueOnce([]),
    });
    const { ctx, violations } = createTestContext(
      {
        layers: [{ name: 'domain', pattern: 'src/domain/**/*.ts' }],
      },
      providers,
    );

    await dependencyDirection.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('does not report a violation for dependencies that do not belong to any layer', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValueOnce(['src/domain/entity.ts']).mockResolvedValueOnce([]),
      getDependencies: vi.fn().mockResolvedValueOnce(['node_modules/lodash/index.js']),
    });
    const { ctx, violations } = createTestContext(
      {
        layers: [
          { name: 'domain', pattern: 'src/domain/**/*.ts' },
          { name: 'application', pattern: 'src/application/**/*.ts' },
        ],
      },
      providers,
    );

    await dependencyDirection.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('has correct rule metadata', () => {
    expect(dependencyDirection.name).toBe('deps/dependency-direction');
    expect(dependencyDirection.needs).toStrictEqual(['graph', 'fs']);
  });
});
