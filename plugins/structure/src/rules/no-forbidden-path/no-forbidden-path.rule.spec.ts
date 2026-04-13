import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noForbiddenPath } from './no-forbidden-path.rule';

describe('structure/no-forbidden-path', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(noForbiddenPath.name).toBe('structure/no-forbidden-path');
      expect(noForbiddenPath.needs).toStrictEqual(['fs']);
    });
  });

  describe('when forbidden paths do not exist', () => {
    it('no violation when no files match', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { patterns: ['dist/**', 'tmp/**'] },
        providers,
        'structure/no-forbidden-path',
      );

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when forbidden paths exist', () => {
    it('reports violations for each matching file', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'dist/**') {
            return Promise.resolve(['dist/index.js', 'dist/utils.js']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { patterns: ['dist/**'] },
        providers,
        'structure/no-forbidden-path',
      );

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('dist/index.js');
      expect(violations[0].message).toContain('dist/**');
      expect(violations[1].message).toContain('dist/utils.js');
    });
  });

  describe('multiple pattern checks', () => {
    it('reports violations for each matched file across multiple patterns', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'dist/**') {
            return Promise.resolve(['dist/bundle.js']);
          }
          if (pattern === 'tmp/**') {
            return Promise.resolve(['tmp/cache.txt']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { patterns: ['dist/**', 'tmp/**'] },
        providers,
        'structure/no-forbidden-path',
      );

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('dist/bundle.js');
      expect(violations[1].message).toContain('tmp/cache.txt');
    });
  });

  describe('empty patterns list', () => {
    it('no violation when patterns is empty', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { patterns: [] },
        providers,
        'structure/no-forbidden-path',
      );

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation location info', () => {
    it('includes file location info in violations', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src/.env']),
      });
      const { ctx, violations } = createTestContext(
        { patterns: ['src/.env'] },
        providers,
        'structure/no-forbidden-path',
      );

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].location).toStrictEqual({ file: 'src/.env' });
    });
  });

  describe('metadata', () => {
    it('outputs correct pattern count in meta', async () => {
      const metaSpy = vi.fn();
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx } = createTestContext(
        { patterns: ['dist/**', 'tmp/**', '.env'] },
        providers,
        'structure/no-forbidden-path',
      );
      const ctxWithMeta = { ...ctx, meta: metaSpy };

      await noForbiddenPath.check(ctxWithMeta);

      expect(metaSpy).toHaveBeenCalledWith('3 patterns checked');
    });
  });
});
