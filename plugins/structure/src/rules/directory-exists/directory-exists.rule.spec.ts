import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { directoryExists } from './directory-exists.rule';

describe('structure/directory-exists', () => {
  describe('규칙 메타데이터', () => {
    it('올바른 이름과 provider 의존성을 가진다', () => {
      expect(directoryExists.name).toBe('structure/directory-exists');
      expect(directoryExists.needs).toStrictEqual(['fs']);
    });
  });

  describe('필수 경로가 존재하는 경우', () => {
    it('경로가 존재하면 위반이 없다', async () => {
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

  describe('필수 경로가 존재하지 않는 경우', () => {
    it('경로가 존재하지 않으면 위반을 보고한다', async () => {
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

  describe('glob 패턴 매칭', () => {
    it('glob 패턴이 매칭되면 위반이 없다', async () => {
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

  describe('빈 required 목록', () => {
    it('required가 비어있으면 위반이 없다', async () => {
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

  describe('여러 경로 검사', () => {
    it('일부 경로만 존재하면 누락된 경로에 대해 위반을 보고한다', async () => {
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

  describe('fix 적용', () => {
    it('fix가 적용되면 디렉토리를 생성한다', async () => {
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

    it('glob 패턴이 누락되면 fix를 제공하지 않는다', async () => {
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

  describe('메타데이터', () => {
    it('올바른 경로 수를 메타에 출력한다', async () => {
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
