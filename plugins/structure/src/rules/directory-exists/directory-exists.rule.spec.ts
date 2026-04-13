import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { directoryExists } from './directory-exists.rule';

describe('structure/directory-exists', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(directoryExists.name).toBe('structure/directory-exists');
      expect(directoryExists.needs).toStrictEqual(['fs']);
    });
  });

  describe('when required paths exist', () => {
    it('no violation when path exists', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src') {
            return Promise.resolve(['src']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { required: ['src'] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when required paths do not exist', () => {
    it('reports violation when path does not exist', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { required: ['src/missing'] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('src/missing');
      expect(violations[0].message).toContain('does not exist');
    });
  });

  describe('glob pattern matching', () => {
    it('no violation when glob pattern matches', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src/**/*.ts') {
            return Promise.resolve(['src/index.ts', 'src/utils.ts']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { required: ['src/**/*.ts'] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('empty required list', () => {
    it('no violation when required is empty', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { required: [] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('multiple path checks', () => {
    it('reports violations for missing paths when only some paths exist', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockImplementation((pattern: string) => {
          if (pattern === 'src') {
            return Promise.resolve(['src']);
          }
          return Promise.resolve([]);
        }),
      });
      const { ctx, violations } = createTestContext(
        { required: ['src', 'docs', 'tests'] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('docs');
      expect(violations[1].message).toContain('tests');
    });
  });

  describe('fix application', () => {
    it('creates directory when fix is applied', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-dir-exists-'));
      try {
        const providers = createMockProviders({
          glob: vi.fn().mockResolvedValue([]),
        });
        const { ctx, violations } = createTestContext(
          { required: ['src/new-dir'] },
          providers,
          'structure/directory-exists',
        );
        const ctxWithRootDir = { ...ctx, rootDir };

        await directoryExists.check(ctxWithRootDir);

        expect(violations).toHaveLength(1);
        expect(violations[0].fix).toBeDefined();

        await violations[0].fix!.apply();

        const dirStat = await stat(join(rootDir, 'src/new-dir'));
        expect(dirStat.isDirectory()).toBe(true);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    });

    it('does not provide fix when glob pattern is missing', async () => {
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { required: ['src/**/*.ts'] },
        providers,
        'structure/directory-exists',
      );

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].fix).toBeUndefined();
    });
  });

  describe('metadata', () => {
    it('outputs correct path count in meta', async () => {
      const metaSpy = vi.fn();
      const providers = createMockProviders({
        glob: vi.fn().mockResolvedValue(['src']),
      });
      const { ctx } = createTestContext(
        { required: ['src', 'docs'] },
        providers,
        'structure/directory-exists',
      );
      const ctxWithMeta = { ...ctx, meta: metaSpy };

      await directoryExists.check(ctxWithMeta);

      expect(metaSpy).toHaveBeenCalledWith('2 paths checked');
    });
  });
});
