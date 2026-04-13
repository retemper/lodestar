import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { coChangeRequired } from './co-change-required.rule';

describe('structure/co-change-required', () => {
  describe('rule metadata', () => {
    it('has correct name and provider dependencies', () => {
      expect(coChangeRequired.name).toBe('structure/co-change-required');
      expect(coChangeRequired.needs).toStrictEqual(['git']);
    });
  });

  describe('when git provider is missing', () => {
    it('exits without violations', async () => {
      const providers = createMockProviders();
      const providersWithoutGit = { ...providers, git: undefined };
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providersWithoutGit,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when there are no changed files', () => {
    it('no violations', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue([]),
        diffFiles: vi.fn().mockResolvedValue([]),
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when watch target is not changed', () => {
    it('no violations', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue(['docs/README.md']),
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when both watch target and require are changed', () => {
    it('no violations', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue(['src/app.ts', 'tests/app.spec.ts']),
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('when watch target is changed but require is not changed', () => {
    it('reports violations', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue(['src/app.ts']),
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('src/app.ts');
      expect(violations[0].message).toContain('tests/**');
    });
  });

  describe('exclude patterns', () => {
    it('excludes matching files from watch via exclude', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue(['src/app.spec.ts']),
      });
      const { ctx, violations } = createTestContext(
        {
          watch: ['src/**/*.ts'],
          require: ['tests/**'],
          exclude: ['**/*.spec.ts'],
        },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('custom messages', () => {
    it('reports with the specified message when message option is present', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue(['src/app.ts']),
      });
      const { ctx, violations } = createTestContext(
        {
          watch: ['src/**/*.ts'],
          require: ['tests/**'],
          message: 'Tests must be updated!',
        },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Tests must be updated!');
    });
  });

  describe('diffFiles fallback (CI context)', () => {
    it('falls back to diffFiles when staged is empty', async () => {
      const diffFiles = vi.fn().mockResolvedValue(['src/app.ts']);
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue([]),
        diffFiles,
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(diffFiles).toHaveBeenCalledWith('origin/main');
      expect(violations).toHaveLength(1);
    });

    it('falls back to empty array when diffFiles fails', async () => {
      const providers = createMockProviders({
        stagedFiles: vi.fn().mockResolvedValue([]),
        diffFiles: vi.fn().mockRejectedValue(new Error('git not available')),
      });
      const { ctx, violations } = createTestContext(
        { watch: ['src/**/*.ts'], require: ['tests/**'] },
        providers,
        'structure/co-change-required',
      );

      await coChangeRequired.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });
});
