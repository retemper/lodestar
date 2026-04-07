import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { pairedFiles } from './paired-files.rule';

describe('structure/paired-files', () => {
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(pairedFiles.name).toBe('structure/paired-files');
      expect(pairedFiles.needs).toStrictEqual(['fs']);
    });
  });

  describe('짝 파일이 존재하는 경우', () => {
    it('모든 짝 파일이 존재하면 위반이 없다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/**/*.ts') {
            return Promise.resolve(['src/utils/helper.ts']);
          }
          return Promise.resolve([]);
        }),
        exists: vi.fn().mockResolvedValue(true),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [{ source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' }],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('짝 파일이 누락된 경우', () => {
    it('짝 파일이 없으면 위반을 보고한다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/**/*.ts') {
            return Promise.resolve(['src/utils/helper.ts']);
          }
          return Promise.resolve([]);
        }),
        exists: vi.fn().mockResolvedValue(false),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [{ source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' }],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('src/utils/helper.ts');
      expect(violations[0].message).toContain('src/utils/helper.spec.ts');
    });
  });

  describe('커스텀 메시지', () => {
    it('커스텀 메시지가 있으면 해당 메시지를 사용한다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/components/Button.tsx']),
        exists: vi.fn().mockResolvedValue(false),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [
            {
              source: 'src/components/**/*.tsx',
              required: '{dir}/{name}.stories.tsx',
              message: 'Every component must have a Storybook story',
            },
          ],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Every component must have a Storybook story');
    });
  });

  describe('여러 소스 파일 매칭', () => {
    it('일부 파일만 짝이 누락되면 해당 파일에 대해서만 위반을 보고한다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/utils/a.ts', 'src/utils/b.ts']),
        exists: vi.fn().mockImplementation((path: string) => {
          if (path === 'src/utils/a.spec.ts') {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [{ source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' }],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('src/utils/b.ts');
    });
  });

  describe('여러 pair 정의', () => {
    it('여러 pair를 독립적으로 검사한다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/**/*.ts') {
            return Promise.resolve(['src/index.ts']);
          }
          if (pattern === 'src/**/*.css') {
            return Promise.resolve(['src/style.css']);
          }
          return Promise.resolve([]);
        }),
        exists: vi.fn().mockResolvedValue(false),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [
            { source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' },
            { source: 'src/**/*.css', required: '{dir}/{name}.module.css' },
          ],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(2);
    });
  });

  describe('빈 pairs 목록', () => {
    it('pairs가 비어있으면 위반이 없다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { pairs: [] },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('위반 위치 정보', () => {
    it('위반에 소스 파일 위치를 포함한다', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/core/engine.ts']),
        exists: vi.fn().mockResolvedValue(false),
      });
      const { ctx, violations } = createTestContext(
        {
          pairs: [{ source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' }],
        },
        providers,
        'structure/paired-files',
      );

      await pairedFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].location).toStrictEqual({ file: 'src/core/engine.ts' });
    });
  });

  describe('fix 적용', () => {
    it('fix가 적용되면 companion 파일을 생성한다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-paired-files-'));
      try {
        const providers = createMockProviders({
          glob: vi.fn().mockResolvedValue(['src/utils/helper.ts']),
          exists: vi.fn().mockResolvedValue(false),
        });
        const { ctx, violations } = createTestContext(
          {
            pairs: [{ source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' }],
          },
          providers,
          'structure/paired-files',
        );
        const ctxWithRootDir = { ...ctx, rootDir };

        await pairedFiles.check(ctxWithRootDir);

        expect(violations).toHaveLength(1);
        expect(violations[0].fix).toBeDefined();

        await violations[0].fix!.apply();

        const fileStat = await stat(join(rootDir, 'src/utils/helper.spec.ts'));
        expect(fileStat.isFile()).toBe(true);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    });
  });

  describe('메타데이터', () => {
    it('올바른 파일 수와 pair 수를 메타에 출력한다', async () => {
      const metaSpy = vi.fn();
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/**/*.ts') {
            return Promise.resolve(['src/a.ts', 'src/b.ts']);
          }
          if (pattern === 'src/**/*.css') {
            return Promise.resolve(['src/c.css']);
          }
          return Promise.resolve([]);
        }),
        exists: vi.fn().mockResolvedValue(true),
      });
      const { ctx } = createTestContext(
        {
          pairs: [
            { source: 'src/**/*.ts', required: '{dir}/{name}.spec.ts' },
            { source: 'src/**/*.css', required: '{dir}/{name}.module.css' },
          ],
        },
        providers,
        'structure/paired-files',
      );
      const ctxWithMeta = { ...ctx, meta: metaSpy };

      await pairedFiles.check(ctxWithMeta);

      expect(metaSpy).toHaveBeenCalledWith('3 files, 2 pairs');
    });
  });
});
