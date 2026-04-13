import { describe, it, expect } from 'vitest';
import { createNodeModulesResolver, extractPackageName } from './node-modules';

describe('extractPackageName', () => {
  it('extracts regular package name', () => {
    expect(extractPackageName('lodash')).toBe('lodash');
  });

  it('extracts only package name from deep import', () => {
    expect(extractPackageName('lodash/fp')).toBe('lodash');
  });

  it('extracts scoped package name', () => {
    expect(extractPackageName('@scope/pkg')).toBe('@scope/pkg');
  });

  it('scoped extracts only package name from deep import', () => {
    expect(extractPackageName('@scope/pkg/sub/path')).toBe('@scope/pkg');
  });

  it('returns null when only @ is present', () => {
    expect(extractPackageName('@incomplete')).toBeNull();
  });
});

describe('createNodeModulesResolver', () => {
  const resolver = createNodeModulesResolver('/root');
  const knownFiles = new Set(['src/a.ts']);

  it('resolves bare specifier to node_modules path', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash',
      knownFiles,
    });

    expect(result).toBe('node_modules/lodash');
  });

  it('resolves scoped packages', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@scope/pkg',
      knownFiles,
    });

    expect(result).toBe('node_modules/@scope/pkg');
  });

  it('resolves deep imports', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash/fp',
      knownFiles,
    });

    expect(result).toBe('node_modules/lodash/fp');
  });

  it('returns null for relative path imports', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './utils',
      knownFiles,
    });

    expect(result).toBeNull();
  });

  it('returns null for absolute path imports', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '/absolute',
      knownFiles,
    });

    expect(result).toBeNull();
  });

  it('caches results', () => {
    const ctx = {
      importer: 'src/a.ts',
      source: 'cached-pkg',
      knownFiles,
    };

    const first = resolver.resolve(ctx);
    const second = resolver.resolve(ctx);

    expect(first).toBe(second);
    expect(first).toBe('node_modules/cached-pkg');
  });
});
