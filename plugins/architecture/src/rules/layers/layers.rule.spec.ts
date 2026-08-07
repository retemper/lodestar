import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import type { ImportInfo } from '@retemper/lodestar-types';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { layers } from './layers.rule';
import type { LayerDefinition } from './layers.rule';

/** Creates an ImportInfo stub */
function makeImport(source: string, file: string, isTypeOnly = false): ImportInfo {
  return { source, specifiers: [], isTypeOnly, kind: 'static', location: { file, line: 1 } };
}

/** Defines standard 3-layer architecture layers */
function makeStandardLayers(): readonly LayerDefinition[] {
  return [
    { name: 'domain', path: 'src/domain/**/*.ts' },
    { name: 'application', path: 'src/application/**/*.ts', canImport: ['domain'] },
    {
      name: 'infrastructure',
      path: 'src/infrastructure/**/*.ts',
      canImport: ['domain', 'application'],
    },
  ];
}

describe('architecture/layers', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(layers.name).toBe('architecture/layers');
      expect(layers.needs).toStrictEqual(['ast', 'fs']);
    });
  });

  describe('allowed inter-layer imports', () => {
    it('no violation when importing layers declared in canImport', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/application/service.ts') {
            return Promise.resolve([
              makeImport('../domain/entity.ts', 'src/application/service.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('tsconfig path alias imports', () => {
    /** Writes a tsconfig.json that maps "@/*" to the project root */
    function makeProjectWithAlias(): string {
      const dir = mkdtempSync(join(tmpdir(), 'lodestar-layers-'));
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }),
      );
      return dir;
    }

    /** Providers for a ui -> infra alias import */
    function makeAliasProviders() {
      return createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'app/**') return Promise.resolve(['app/page.tsx']);
          if (pattern === 'server/db/**') return Promise.resolve(['server/db/index.ts']);
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'app/page.tsx') {
            return Promise.resolve([makeImport('@/server/db', 'app/page.tsx')]);
          }
          return Promise.resolve([]);
        }),
      });
    }

    it('reports a violation when an alias import crosses a forbidden layer boundary', async () => {
      const { ctx, violations } = createTestContext(
        {
          layers: [
            { name: 'ui', path: 'app/**', canImport: [] },
            { name: 'infra', path: 'server/db/**' },
          ] as readonly LayerDefinition[],
        },
        makeAliasProviders(),
        'architecture/layers',
      );
      Object.defineProperty(ctx, 'rootDir', { value: makeProjectWithAlias() });

      await layers.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain('cannot import from "infra"');
    });

    it('no violation when the alias import target is declared in canImport', async () => {
      const { ctx, violations } = createTestContext(
        {
          layers: [
            { name: 'ui', path: 'app/**', canImport: ['infra'] },
            { name: 'infra', path: 'server/db/**' },
          ] as readonly LayerDefinition[],
        },
        makeAliasProviders(),
        'architecture/layers',
      );
      Object.defineProperty(ctx, 'rootDir', { value: makeProjectWithAlias() });

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('forbidden inter-layer imports', () => {
    it('reports 1 violation when importing a layer not in canImport', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('../application/service.ts', 'src/domain/entity.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('domain');
      expect(violations[0].message).toContain('application');
      expect(violations[0].message).toContain('canImport');
    });
  });

  describe('intra-layer imports', () => {
    it('imports within the same layer are always allowed', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts', 'src/domain/value-object.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([makeImport('./value-object.ts', 'src/domain/entity.ts')]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('imports from files not belonging to any layer', () => {
    it('ignores imports from files outside layers', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/application/service.ts') {
            return Promise.resolve([
              makeImport('../utils/helper.ts', 'src/application/service.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('npm package imports', () => {
    it('ignores non-relative (npm package) imports', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('lodash', 'src/domain/entity.ts'),
              makeImport('@nestjs/common', 'src/domain/entity.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('allowTypeOnly option', () => {
    it('allows type-only cross-layer imports when allowTypeOnly is true', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('../application/service.ts', 'src/domain/entity.ts', true),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers(), allowTypeOnly: true },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('layers with empty canImport', () => {
    it('layers without canImport can only import external and out-of-layer files', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('../infrastructure/repo.ts', 'src/domain/entity.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('domain');
      expect(violations[0].message).toContain('infrastructure');
    });
  });

  describe('multiple violations from a single file', () => {
    it('reports all forbidden imports from a single file', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('../application/service.ts', 'src/domain/entity.ts'),
              makeImport('../infrastructure/repo.ts', 'src/domain/entity.ts'),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('application');
      expect(violations[1].message).toContain('infrastructure');
    });
  });

  describe('layers with empty array canImport', () => {
    it('cannot import other layers when canImport is an empty array', async () => {
      const layerDefs: readonly LayerDefinition[] = [
        { name: 'core', path: 'src/core/**/*.ts', canImport: [] },
        { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['core'] },
      ];
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/core/**/*.ts') {
            return Promise.resolve(['src/core/entity.ts']);
          }
          if (pattern === 'src/infra/**/*.ts') {
            return Promise.resolve(['src/infra/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/core/entity.ts') {
            return Promise.resolve([makeImport('../infra/repo.ts', 'src/core/entity.ts')]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: layerDefs },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('core');
      expect(violations[0].message).toContain('infra');
    });
  });

  describe('type-only imports when allowTypeOnly is false', () => {
    it('type-only cross-layer imports are also violations when allowTypeOnly is false', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockImplementation((file: string) => {
          if (file === 'src/domain/entity.ts') {
            return Promise.resolve([
              makeImport('../application/service.ts', 'src/domain/entity.ts', true),
            ]);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers(), allowTypeOnly: false },
        providers,
        'architecture/layers',
      );

      await layers.check(ctx);

      expect(violations).toHaveLength(1);
    });
  });

  describe('metadata', () => {
    it('outputs correct file count and layer count in meta', async () => {
      const metaSpy = vi.fn();
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/domain/**/*.ts') {
            return Promise.resolve(['src/domain/entity.ts']);
          }
          if (pattern === 'src/application/**/*.ts') {
            return Promise.resolve(['src/application/service.ts']);
          }
          if (pattern === 'src/infrastructure/**/*.ts') {
            return Promise.resolve(['src/infrastructure/repo.ts']);
          }
          return Promise.resolve([]);
        }),
        getImports: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { layers: makeStandardLayers() },
        providers,
        'architecture/layers',
      );
      const ctxWithMeta = { ...ctx, meta: metaSpy };

      await layers.check(ctxWithMeta);

      expect(violations).toHaveLength(0);
      expect(metaSpy).toHaveBeenCalledWith('3 files, 3 layers');
    });
  });
});
