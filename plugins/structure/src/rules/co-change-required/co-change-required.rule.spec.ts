import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { coChangeRequired } from './co-change-required.rule';

describe('structure/co-change-required', () => {
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(coChangeRequired.name).toBe('structure/co-change-required');
      expect(coChangeRequired.needs).toStrictEqual(['git']);
    });
  });

  describe('git provider가 없는 경우', () => {
    it('위반 없이 종료한다', async () => {
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

  describe('변경 파일이 없는 경우', () => {
    it('위반이 없다', async () => {
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

  describe('watch 대상이 변경되지 않은 경우', () => {
    it('위반이 없다', async () => {
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

  describe('watch 대상이 변경되고 require도 변경된 경우', () => {
    it('위반이 없다', async () => {
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

  describe('watch 대상이 변경되었지만 require가 변경되지 않은 경우', () => {
    it('위반을 보고한다', async () => {
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

  describe('exclude 패턴', () => {
    it('exclude에 해당하는 파일은 watch에서 제외한다', async () => {
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

  describe('커스텀 메시지', () => {
    it('message 옵션이 있으면 해당 메시지로 보고한다', async () => {
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

  describe('diffFiles fallback (CI 컨텍스트)', () => {
    it('staged가 비어있으면 diffFiles로 fallback한다', async () => {
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

    it('diffFiles가 실패하면 빈 배열로 fallback한다', async () => {
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
