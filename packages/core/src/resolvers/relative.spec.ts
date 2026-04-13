import { describe, it, expect } from 'vitest';
import { createRelativeResolver, normalizePath, tryResolve } from './relative';

describe('normalizePath', () => {
  it('removes . segments', () => {
    expect(normalizePath('src/./a.ts')).toBe('src/a.ts');
  });

  it('resolves .. segments', () => {
    expect(normalizePath('src/deep/../a.ts')).toBe('src/a.ts');
  });

  it('ignores empty segments', () => {
    expect(normalizePath('src//a.ts')).toBe('src/a.ts');
  });

  it('resolves multiple levels of ..', () => {
    expect(normalizePath('src/a/b/../../c.ts')).toBe('src/c.ts');
  });
});

describe('tryResolve', () => {
  it('returns exact path when it exists', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/a.ts', files)).toBe('src/a.ts');
  });

  it('infers extension', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/a', files)).toBe('src/a.ts');
  });

  it('infers .tsx extension', () => {
    const files = new Set(['src/App.tsx']);
    expect(tryResolve('src/App', files)).toBe('src/App.tsx');
  });

  it('infers index file', () => {
    const files = new Set(['src/utils/index.ts']);
    expect(tryResolve('src/utils', files)).toBe('src/utils/index.ts');
  });

  it('returns null when unable to resolve', () => {
    const files = new Set(['src/a.ts']);
    expect(tryResolve('src/b', files)).toBeNull();
  });
});

describe('createRelativeResolver', () => {
  const resolver = createRelativeResolver();
  const knownFiles = new Set(['src/a.ts', 'src/b.ts', 'src/utils/index.ts']);

  it('resolves relative path imports', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './b',
      knownFiles,
    });
    expect(result).toBe('src/b.ts');
  });

  it('resolves parent directory relative path', () => {
    const result = resolver.resolve({
      importer: 'src/utils/index.ts',
      source: '../b',
      knownFiles,
    });
    expect(result).toBe('src/b.ts');
  });

  it('resolves directory import to index', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './utils',
      knownFiles,
    });
    expect(result).toBe('src/utils/index.ts');
  });

  it('returns null for non-relative imports', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash',
      knownFiles,
    });
    expect(result).toBeNull();
  });

  it('returns null for alias imports starting with @', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles,
    });
    expect(result).toBeNull();
  });

  it('returns null for unresolvable relative path', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './nonexistent',
      knownFiles,
    });
    expect(result).toBeNull();
  });
});
