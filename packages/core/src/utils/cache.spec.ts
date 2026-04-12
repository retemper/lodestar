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
  it('동일한 내용에 대해 같은 해시를 반환한다', () => {
    expect(contentHash('hello world')).toBe(contentHash('hello world'));
  });

  it('다른 내용에 대해 다른 해시를 반환한다', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });

  it('16자 길이의 해시를 반환한다', () => {
    expect(contentHash('test')).toHaveLength(16);
  });
});

describe('createDiskCacheProvider', () => {
  it('값을 저장하고 조회한다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('test-ns', 'key1', { data: 42 });
    const result = await cache.get<{ data: number }>('test-ns', 'key1');

    expect(result).toStrictEqual({ data: 42 });
  });

  it('존재하지 않는 키에 대해 null을 반환한다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    const result = await cache.get('test-ns', 'nonexistent');

    expect(result).toBeNull();
  });

  it('네임스페이스별로 값을 분리한다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');

    expect(await cache.get('ns-a', 'key')).toBe('value-a');
    expect(await cache.get('ns-b', 'key')).toBe('value-b');
  });

  it('특정 네임스페이스를 삭제한다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');
    await cache.clear('ns-a');

    expect(await cache.get('ns-a', 'key')).toBeNull();
    expect(await cache.get('ns-b', 'key')).toBe('value-b');
  });

  it('전체 캐시를 삭제한다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns-a', 'key', 'value-a');
    await cache.set('ns-b', 'key', 'value-b');
    await cache.clear();

    expect(await cache.get('ns-a', 'key')).toBeNull();
    expect(await cache.get('ns-b', 'key')).toBeNull();
  });

  it('배열 데이터를 저장하고 조회한다', async () => {
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

  it('같은 키에 값을 덮어쓴다', async () => {
    const dir = await tempDir();
    const cache = createDiskCacheProvider(dir);

    await cache.set('ns', 'key', 'old');
    await cache.set('ns', 'key', 'new');

    expect(await cache.get('ns', 'key')).toBe('new');
  });
});
