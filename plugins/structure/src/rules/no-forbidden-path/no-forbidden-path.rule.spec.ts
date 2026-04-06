import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
import { noForbiddenPath } from './no-forbidden-path.rule';

describe('structure/no-forbidden-path', () => {
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(noForbiddenPath.name).toBe('structure/no-forbidden-path');
      expect(noForbiddenPath.needs).toStrictEqual(['fs']);
    });
  });

  describe('금지된 경로가 존재하지 않는 경우', () => {
    it('매칭되는 파일이 없으면 위반이 없다', async () => {
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

  describe('금지된 경로가 존재하는 경우', () => {
    it('매칭되는 파일이 있으면 각각 위반을 보고한다', async () => {
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

  describe('여러 패턴 검사', () => {
    it('여러 패턴에서 각각 매칭된 파일에 대해 위반을 보고한다', async () => {
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

  describe('빈 patterns 목록', () => {
    it('patterns가 비어있으면 위반이 없다', async () => {
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

  describe('위반 위치 정보', () => {
    it('위반에 파일 위치 정보를 포함한다', async () => {
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

  describe('메타데이터', () => {
    it('올바른 패턴 수를 메타에 출력한다', async () => {
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
