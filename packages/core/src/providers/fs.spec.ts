import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFileSystemProvider } from './fs';

/** 정리할 임시 디렉토리 목록 */
const dirs: string[] = [];

/** 임시 디렉토리를 생성하고 파일을 배치한다 */
async function setupFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
  dirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
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
    it('패턴에 맞는 파일 목록을 반환한다', async () => {
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

    it('일치하는 파일이 없으면 빈 배열을 반환한다', async () => {
      const rootDir = await setupFixture({
        'src/a.js': '',
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.glob('**/*.ts');

      expect(result).toStrictEqual([]);
    });
  });

  describe('readFile', () => {
    it('파일 내용을 UTF-8 문자열로 반환한다', async () => {
      const rootDir = await setupFixture({
        'hello.txt': 'Hello, world!',
      });
      const provider = createFileSystemProvider(rootDir);

      const content = await provider.readFile('hello.txt');

      expect(content).toBe('Hello, world!');
    });

    it('존재하지 않는 파일은 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      await expect(provider.readFile('nonexistent.txt')).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('파일이 존재하면 true를 반환한다', async () => {
      const rootDir = await setupFixture({
        'exists.txt': '',
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.exists('exists.txt');

      expect(result).toBe(true);
    });

    it('파일이 없으면 false를 반환한다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.exists('nonexistent.txt');

      expect(result).toBe(false);
    });
  });

  describe('readJson', () => {
    it('JSON 파일을 파싱하여 반환한다', async () => {
      const rootDir = await setupFixture({
        'data.json': JSON.stringify({ key: 'value', count: 42 }),
      });
      const provider = createFileSystemProvider(rootDir);

      const result = await provider.readJson<{ key: string; count: number }>('data.json');

      expect(result).toStrictEqual({ key: 'value', count: 42 });
    });

    it('존재하지 않는 JSON 파일은 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-fs-test-'));
      dirs.push(rootDir);
      const provider = createFileSystemProvider(rootDir);

      await expect(provider.readJson('missing.json')).rejects.toThrow();
    });
  });
});
