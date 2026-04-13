import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** Disk cache provider for persisting parse results across runs */
interface CacheProvider {
  /** Retrieve a cached value by namespace and key */
  get<T>(namespace: string, key: string): Promise<T | null>;
  /** Store a value under namespace and key */
  set<T>(namespace: string, key: string, value: T): Promise<void>;
  /** Clear all cached data, optionally scoped to a namespace */
  clear(namespace?: string): Promise<void>;
}

/**
 * Generate a truncated SHA-1 hash of file content for cache keying.
 * @param content - file content to hash
 */
function contentHash(content: string): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 16);
}

/**
 * Create a disk-based cache provider storing JSON files under node_modules/.cache/lodestar.
 * @param rootDir - absolute project root path
 */
function createDiskCacheProvider(rootDir: string): CacheProvider {
  const cacheDir = join(rootDir, 'node_modules', '.cache', 'lodestar');

  return {
    async get<T>(namespace: string, key: string): Promise<T | null> {
      const filePath = join(cacheDir, namespace, `${key}.json`);
      try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },

    async set<T>(namespace: string, key: string, value: T): Promise<void> {
      const dir = join(cacheDir, namespace);
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, `${key}.json`);
      await writeFile(filePath, JSON.stringify(value), 'utf-8');
    },

    async clear(namespace?: string): Promise<void> {
      const target = namespace ? join(cacheDir, namespace) : cacheDir;
      await rm(target, { recursive: true, force: true });
    },
  };
}

export { createDiskCacheProvider, contentHash };
export type { CacheProvider };
