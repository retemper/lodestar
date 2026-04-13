import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFileSystemProvider } from './fs';

/** List of temporary directories to clean up */
const dirs: string[] = [];

/** Creates a temporary directory and places files in it */
async function setupFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
  dirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  return rootDir;
}

afterAll(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('createFileSystemProvider', () => {
  describe('glob', () => {
    it('returns file list matching pattern', async () => {
      const rootDir = await setupFixture({
        'src/a.ts': '',
        'src/b.ts': '',
        'src/c.js': '',
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.glob('**/*.ts');

      expect(result).toHaveLength(2);
      expect([...result].sort()).toStrictEqual(['src/a.ts', 'src/b.ts']);
    });

    it('returns empty array when no files match', async () => {
      const rootDir = await setupFixture({
        'src/a.js': '',
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.glob('**/*.ts');

      expect(result).toStrictEqual([]);
    });

    it('excludes directories from glob results', async () => {
      const rootDir = await setupFixture({
        'src/components/Button.ts': '',
        'src/components/Modal.ts': '',
      });
      // 'src/components' is a directory that could match 'src/**'
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.glob('src/**');

      for (const entry of result) {
        expect(entry).toMatch(/\.ts$/);
      }
      expect(result).not.toContain('src/components');
    });
  });

  describe('readFile', () => {
    it('returns file content as UTF-8 string', async () => {
      const rootDir = await setupFixture({
        'hello.txt': 'Hello, world!',
      });
      const provider = createFileSystemProvider(rootDir);

      const content = await provider.readFile('hello.txt');

      expect(content).toBe('Hello, world!');
    });

    it('throws error for non-existent files', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      await expect(provider.readFile('nonexistent.txt')).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      const rootDir = await setupFixture({
        'exists.txt': '',
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.exists('exists.txt');

      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.exists('nonexistent.txt');

      expect(result).toBe(false);
    });
  });

  describe('readJson', () => {
    it('parses and returns JSON files', async () => {
      const rootDir = await setupFixture({
        'data.json': JSON.stringify({ key: 'value', count: 42 }),
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.readJson<{ key: string; count: number }>('data.json');

      expect(result).toStrictEqual({ key: 'value', count: 42 });
    });

    it('throws error for non-existent JSON files', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      await expect(provider.readJson('missing.json')).rejects.toThrow();
    });
  });
});
