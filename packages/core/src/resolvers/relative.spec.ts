import { describe, it, expect } from 'vitest';
import { createRelativeResolver, normalizePath, tryResolve } from './relative';

describe('normalizePath', () => {
  it('. 세그먼트를 제거한다', () => {
    expect(normalizePath('src/./a.ts')).toBe('src/a.ts');
  });

  it('.. 세그먼트를 해석한다', () => {
    expect(normalizePath('src/deep/../a.ts')).toBe('src/a.ts');
  });

  it('빈 세그먼트를 무시한다', () => {
    expect(normalizePath('src//a.ts')).toBe('src/a.ts');
  });

  it('여러 단계의 ..를 해석한다', () => {
    expect(normalizePath('src/a/b/../../c.ts')).toBe('src/c.ts');
  });
});

describe('tryResolve', () => {
  it('정확한 경로가 있으면 반환한다', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/a.ts', files)).toBe('src/a.ts');
  });

  it('확장자를 추론한다', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/a', files)).toBe('src/a.ts');
  });

  it('.tsx 확장자를 추론한다', () => {
    const files = new Set(['src/App.tsx']);
    expect(tryResolve('src/App', files)).toBe('src/App.tsx');
  });

  it('index 파일을 추론한다', () => {
    const files = new Set(['src/utils/index.ts']);
    expect(tryResolve('src/utils', files)).toBe('src/utils/index.ts');
  });

  it('해석할 수 없으면 null을 반환한다', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/b', files)).toBeNull();
  });
});

describe('createRelativeResolver', () => {
  const resolver = createRelativeResolver();
  const knownFiles = new Set(['src/a.ts', 'src/b.ts', 'src/utils/index.ts']);

  it('상대 경로 import를 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './b',
      knownFiles,
    });
    expect(result).toBe('src/b.ts');
  });

  it('부모 디렉토리 상대 경로를 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/utils/index.ts',
      source: '../b',
      knownFiles,
    });
    expect(result).toBe('src/b.ts');
  });

  it('디렉토리 import를 index로 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './utils',
      knownFiles,
    });
    expect(result).toBe('src/utils/index.ts');
  });

  it('비상대 import는 null을 반환한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash',
      knownFiles,
    });
    expect(result).toBeNull();
  });

  it('@로 시작하는 alias import는 null을 반환한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles,
    });
    expect(result).toBeNull();
  });

  it('해석할 수 없는 상대 경로는 null을 반환한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './nonexistent',
      knownFiles,
    });
    expect(result).toBeNull();
  });
});
