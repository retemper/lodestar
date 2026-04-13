import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDiskCacheProvider, contentHash } from './cache';

const dirs: string[] = [];

/** Create a temp directory for testing */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'lodestar-cache-test-'));
  dirs.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('contentHash', () => {
  it('returns same hash for identical content', () => {
    expect(contentHash('hello world')).toBe(contentHash('hello world'));
  });

  it('returns different hash for different content', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });

  it('returns a 16-character hash', () => {
    expect(contentHash('test')).toHaveLength(16);
  });
});

describe('createDiskCacheProvider', () => {
  it('stores and retrieves values', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('test-ns', 'key1', { data: 42 });
    const result = await cache.get<{ data: number }>('test-ns', 'key1');

    expect(result).toStrictEqual({ data: 42 });
  });

  it('returns null for non-existent keys', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    const result = await cache.get('test-ns', 'nonexistent');

    expect(result).toBeNull();
  });

  it('separates values by namespace', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');

    expect(await cache.get('ns-a', 'key')).toBe('value-a');
    expect(await cache.get('ns-b', 'key')).toBe('value-b');
  });

  it('clears specific namespace', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');
    await cache.clear('ns-a');

    expect(await cache.get('ns-a', 'key')).toBeNull();
    expect(await cache.get('ns-b', 'key')).toBe('value-b');
  });

  it('clears entire cache', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');
    await cache.clear();

    expect(await cache.get('ns-a', 'key')).toBeNull();
    expect(await cache.get('ns-b', 'key')).toBeNull();
  });

  it('stores and retrieves array data', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);
    const data = [
      {
        source: './a',
        specifiers: ['x'],
        isTypeOnly: false,
        kind: 'static',
        location: { file: 'test.ts' },
      },
    ];

    await cache.set('imports', 'abc123', data);
    const result = await cache.get('imports', 'abc123');

    expect(result).toStrictEqual(data);
  });

  it('overwrites value for same key', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns', 'key', 'old');
    await cache.set('ns', 'key', 'new');

    expect(await cache.get('ns', 'key')).toBe('new');
  });
});
