import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noLooseFiles } from './no-loose-files.rule';

describe('structure/no-loose-files', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(noLooseFiles.name).toBe('structure/no-loose-files');
      expect(noLooseFiles.needs).toStrictEqual(['fs']);
    });
  });

  describe('when there are no loose files', () => {
    it('no violation when only directories exist', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/providers', 'src/resolvers']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(0);
    });

    it('allows files in allow list', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/index.ts']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'], allow: ['index.ts'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when loose files exist', () => {
    it('reports files with extensions as violations', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/engine.ts', 'src/cache.ts', 'src/providers']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('engine.ts');
      expect(violations[1].message).toContain('cache.ts');
    });

    it('reports remaining files excluding allow list', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/index.ts', 'src/engine.ts', 'src/logger.ts']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'], allow: ['index.ts'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('engine.ts');
      expect(violations[1].message).toContain('logger.ts');
    });
  });

  describe('multiple directory checks', () => {
    it('checks each dir individually', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'packages/core/src/*') {
            return Promise.resolve(['packages/core/src/engine.ts']);
          }
          if (pattern === 'packages/cli/src/*') {
            return Promise.resolve(['packages/cli/src/index.ts']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['packages/core/src', 'packages/cli/src'], allow: ['index.ts'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('engine.ts');
      expect(violations[0].location).toStrictEqual({ file: 'packages/core/src/engine.ts' });
    });
  });

  describe('violation location info', () => {
    it('includes file location info in violations', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/cache.ts']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].location).toStrictEqual({ file: 'src/cache.ts' });
    });
  });

  describe('metadata', () => {
    it('outputs found loose file count in meta', async () => {
      const metaSpy = vi.fn();
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/a.ts', 'src/b.ts', 'src/providers']),
      });
      const { ctx } = createTestContext({ dirs: ['src'] }, providers, 'structure/no-loose-files');
      const ctxWithMeta = { ...ctx, meta: metaSpy };

      await noLooseFiles.check(ctxWithMeta);

      expect(metaSpy).toHaveBeenCalledWith('2 loose files found');
    });
  });

  describe('allow defaults', () => {
    it('all files are violations when allow is not specified', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/index.ts', 'src/engine.ts']),
      });
      const { ctx, violations } = createTestContext(
        { dirs: ['src'] },
        providers,
        'structure/no-loose-files',
      );

      await noLooseFiles.check(ctx);

      expect(violations).toHaveLength(2);
    });
  });
});
