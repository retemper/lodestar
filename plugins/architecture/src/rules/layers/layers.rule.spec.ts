import { describe, it, expect, vi } from 'vitest';
import type { ImportInfo } from '@lodestar/types';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { layers } from './layers.rule';
import type { LayerDefinition } from './layers.rule';

/** ImportInfo 스텁 생성 */
function makeImport(source: string, file: string, isTypeOnly = false): ImportInfo {
  return { source, specifiers: [], isTypeOnly, location: { file, line: 1 } };
}

/** 표준 3계층 아키텍처 레이어 정의 */
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
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(layers.name).toBe('architecture/layers');
      expect(layers.needs).toStrictEqual(['ast', 'fs']);
    });
  });

  describe('허용된 레이어 간 import', () => {
    it('canImport에 선언된 레이어를 import하면 위반이 없다', async () => {
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

  describe('금지된 레이어 간 import', () => {
    it('canImport에 없는 레이어를 import하면 1건의 위반을 보고한다', async () => {
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

  describe('동일 레이어 내부 import', () => {
    it('같은 레이어 내의 import는 항상 허용된다', async () => {
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

  describe('레이어에 속하지 않는 파일에서의 import', () => {
    it('레이어 밖 파일의 import는 무시한다', async () => {
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

  describe('npm 패키지 import', () => {
    it('비상대경로(npm 패키지) import는 무시한다', async () => {
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

  describe('allowTypeOnly 옵션', () => {
    it('allowTypeOnly가 true이면 type-only 크로스레이어 import를 허용한다', async () => {
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

  describe('canImport가 비어있는 레이어', () => {
    it('canImport가 없는 레이어는 외부 및 레이어 밖 파일만 import할 수 있다', async () => {
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

  describe('하나의 파일에서 여러 위반', () => {
    it('한 파일에서 여러 금지된 import가 있으면 모두 보고한다', async () => {
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

  describe('메타데이터', () => {
    it('올바른 파일 수와 레이어 수를 메타에 출력한다', async () => {
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
