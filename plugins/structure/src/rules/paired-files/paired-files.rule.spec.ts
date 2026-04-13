import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { pairedFiles } from './paired-files.rule';

describe('structure/paired-files', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(pairedFiles.name).toBe('structure/paired-files');
      expect(pairedFiles.needs).toStrictEqual(['fs']);
    });
  });

  describe('when paired files exist', () => {
    it('no violation when all paired files exist', async () => {
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

  describe('when paired files are missing', () => {
    it('reports violation when paired file is missing', async () => {
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

  describe('custom messages', () => {
    it('uses the specified message when custom message is present', async () => {
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

  describe('multiple source file matching', () => {
    it('reports violations only for files with missing pairs', async () => {
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

  describe('multiple pair definitions', () => {
    it('checks each pair independently', async () => {
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

  describe('empty pairs list', () => {
    it('no violation when pairs is empty', async () => {
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

  describe('violation location info', () => {
    it('includes source file location in violations', async () => {
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

  describe('fix application', () => {
    it('creates companion file when fix is applied', async () => {
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

  describe('metadata', () => {
    it('outputs correct file count and pair count in meta', async () => {
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
