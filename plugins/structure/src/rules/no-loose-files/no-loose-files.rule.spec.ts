import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noLooseFiles } from './no-loose-files.rule';

describe('structure/no-loose-files', () => {
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(noLooseFiles.name).toBe('structure/no-loose-files');
      expect(noLooseFiles.needs).toStrictEqual(['fs']);
    });
  });

  describe('loose 파일이 없는 경우', () => {
    it('디렉토리만 있으면 위반이 없다', async () => {
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

    it('allow 목록 파일은 통과한다', async () => {
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

  describe('loose 파일이 있는 경우', () => {
    it('확장자가 있는 파일은 위반으로 보고한다', async () => {
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

    it('allow 목록 파일을 제외하고 나머지를 보고한다', async () => {
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

  describe('여러 디렉토리 검사', () => {
    it('여러 dirs를 각각 검사한다', async () => {
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

  describe('위반 위치 정보', () => {
    it('위반에 파일 위치 정보를 포함한다', async () => {
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

  describe('메타데이터', () => {
    it('발견된 loose 파일 수를 메타에 출력한다', async () => {
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

  describe('allow 기본값', () => {
    it('allow를 지정하지 않으면 모든 파일이 위반이다', async () => {
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
