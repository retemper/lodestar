import { describe, it, expect } from 'vitest';
import { createNodeModulesResolver, extractPackageName } from './node-modules';

describe('extractPackageName', () => {
  it('일반 패키지명을 추출한다', () => {
    expect(extractPackageName('lodash')).toBe('lodash');
  });

  it('deep import에서 패키지명만 추출한다', () => {
    expect(extractPackageName('lodash/fp')).toBe('lodash');
  });

  it('scoped 패키지명을 추출한다', () => {
    expect(extractPackageName('@scope/pkg')).toBe('@scope/pkg');
  });

  it('scoped deep import에서 패키지명만 추출한다', () => {
    expect(extractPackageName('@scope/pkg/sub/path')).toBe('@scope/pkg');
  });

  it('@ 하나만 있으면 null을 반환한다', () => {
    expect(extractPackageName('@incomplete')).toBeNull();
  });
});

describe('createNodeModulesResolver', () => {
  const resolver = createNodeModulesResolver('/root');
  const knownFiles = new Set(['src/a.ts']);

  it('bare specifier를 node_modules 경로로 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash',
      knownFiles,
    });

    expect(result).toBe('node_modules/lodash');
  });

  it('scoped 패키지를 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@scope/pkg',
      knownFiles,
    });

    expect(result).toBe('node_modules/@scope/pkg');
  });

  it('deep import를 해석한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: 'lodash/fp',
      knownFiles,
    });

    expect(result).toBe('node_modules/lodash/fp');
  });

  it('상대 경로 import는 null을 반환한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './utils',
      knownFiles,
    });

    expect(result).toBeNull();
  });

  it('절대 경로 import는 null을 반환한다', () => {
    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '/absolute',
      knownFiles,
    });

    expect(result).toBeNull();
  });

  it('결과를 캐시한다', () => {
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
