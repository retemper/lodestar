import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createConfigFileProvider } from './config-file';

/** List of temporary directories to clean up */
const dirs: string[] = [];

/** Creates a temporary directory and places JSON files in it */
async function setupFixture(files: Record<string, unknown>): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
  dirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    const dir = dirname(fullPath);
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
    it('reads root package.json', async () => {
      const rootDir = await setupFixture({
        'package.json': { name: 'test-pkg', version: '1.0.0' },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getPackageJson();

      expect(result).toStrictEqual({ name: 'test-pkg', version: '1.0.0' });
    });

    it('reads package.json from subdirectory via dir parameter', async () => {
      const rootDir = await setupFixture({
        'packages/sub/package.json': { name: 'sub-pkg' },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getPackageJson('packages/sub');

      expect(result).toStrictEqual({ name: 'sub-pkg' });
    });

    it('throws error when file is missing', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getPackageJson()).rejects.toThrow();
    });
  });

  describe('getTsConfig', () => {
    it('reads root tsconfig.json', async () => {
      const rootDir = await setupFixture({
        'tsconfig.json': { compilerOptions: { strict: true } },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getTsConfig();

      expect(result).toStrictEqual({ compilerOptions: { strict: true } });
    });

    it('reads tsconfig.json from subdirectory via dir parameter', async () => {
      const rootDir = await setupFixture({
        'packages/app/tsconfig.json': { compilerOptions: { target: 'es2020' } },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getTsConfig('packages/app');

      expect(result).toStrictEqual({ compilerOptions: { target: 'es2020' } });
    });

    it('throws error when file is missing', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getTsConfig()).rejects.toThrow();
    });
  });

  describe('getCustomConfig', () => {
    it('reads arbitrary JSON config files', async () => {
      const rootDir = await setupFixture({
        '.eslintrc.json': { extends: ['recommended'] },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getCustomConfig('.eslintrc.json');

      expect(result).toStrictEqual({ extends: ['recommended'] });
    });

    it('reads config file from subdirectory via dir parameter', async () => {
      const rootDir = await setupFixture({
        'apps/web/.prettierrc.json': { singleQuote: true },
      });
      const provider = createConfigFileProvider(rootDir);

      const result = await provider.getCustomConfig('.prettierrc.json', 'apps/web');

      expect(result).toStrictEqual({ singleQuote: true });
    });

    it('throws error when file is missing', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));
      dirs.push(rootDir);
      const provider = createConfigFileProvider(rootDir);

      await expect(provider.getCustomConfig('nonexistent.json')).rejects.toThrow();
    });
  });
});
