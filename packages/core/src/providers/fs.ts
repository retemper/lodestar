import { readFile, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { FileSystemProvider } from '@lodestar/types';

/**
 * Create a file system provider rooted at the given directory.
 * @param rootDir - absolute path; all relative paths passed to provider methods resolve against this
 */
function createFileSystemProvider(rootDir: string): FileSystemProvider {
  return {
    async glob(pattern: string): Promise<readonly string[]> {
      const { glob } = await import('node:fs/promises');
      const matches: string[] = [];
      for await (const entry of glob(pattern, { cwd: rootDir })) {
        matches.push(relative(rootDir, join(rootDir, entry)));
      }
      return matches;
    },

    async readFile(path: string): Promise<string> {
      const fullPath = join(rootDir, path);
      return readFile(fullPath, 'utf-8');
    },

    async exists(path: string): Promise<boolean> {
      try {
        await access(join(rootDir, path));
        return true;
      } catch {
        return false;
      }
    },

    async readJson<T = unknown>(path: string): Promise<T> {
      const content = await readFile(join(rootDir, path), 'utf-8');
      return JSON.parse(content) as T;
    },
  };
}

export { createFileSystemProvider };
