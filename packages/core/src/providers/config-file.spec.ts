import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createConfigFileProvider } from './config-file';

/** 정리할 임시 디렉토리 목록 */
const dirs: string[] = [];

/** 임시 디렉토리를 생성하고 JSON 파일을 배치한다 */
async function setupFixture(
  files: Record<string, unknown>,
): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
  dirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, JSON.stringify(content), 'utf-8');
  }

  return rootDir;
}

afterAll(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('createConfigFileProvider', () => {
  describe('getPackageJson', () => {
    it('루트의 package.json을 읽는다', async () => {
      const rootDir = await setupFixture({
        'package.json': { name: 'test-pkg', version: '1.0.0' },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getPackageJson();

      expect(result).toStrictEqual({ name: 'test-pkg', version: '1.0.0' });
    });

    it('dir 파라미터로 하위 디렉토리의 package.json을 읽는다', async () => {
      const rootDir = await setupFixture({
        'packages/sub/package.json': { name: 'sub-pkg' },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getPackageJson('packages/sub');

      expect(result).toStrictEqual({ name: 'sub-pkg' });
    });

    it('파일이 없으면 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getPackageJson()).rejects.toThrow();
    });
  });

  describe('getTsConfig', () => {
    it('루트의 tsconfig.json을 읽는다', async () => {
      const rootDir = await setupFixture({
        'tsconfig.json': { compilerOptions: { strict: true } },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getTsConfig();

      expect(result).toStrictEqual({ compilerOptions: { strict: true } });
    });

    it('dir 파라미터로 하위 디렉토리의 tsconfig.json을 읽는다', async () => {
      const rootDir = await setupFixture({
        'packages/app/tsconfig.json': { compilerOptions: { target: 'es2020' } },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getTsConfig('packages/app');

      expect(result).toStrictEqual({ compilerOptions: { target: 'es2020' } });
    });

    it('파일이 없으면 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getTsConfig()).rejects.toThrow();
    });
  });

  describe('getCustomConfig', () => {
    it('임의의 JSON 설정 파일을 읽는다', async () => {
      const rootDir = await setupFixture({
        '.eslintrc.json': { extends: ['recommended'] },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getCustomConfig('.eslintrc.json');

      expect(result).toStrictEqual({ extends: ['recommended'] });
    });

    it('dir 파라미터로 하위 디렉토리의 설정 파일을 읽는다', async () => {
      const rootDir = await setupFixture({
        'apps/web/.prettierrc.json': { singleQuote: true },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getCustomConfig('.prettierrc.json', 'apps/web');

      expect(result).toStrictEqual({ singleQuote: true });
    });

    it('파일이 없으면 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getCustomConfig('nonexistent.json')).rejects.toThrow();
    });
  });
});
