import { describe, it, expect } from 'vitest';
import { resolveImport, normalizePath } from './resolve-import';

describe('resolveImport', () => {
  it('returns null for npm packages (non-relative paths)', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', 'lodash', knownFiles)).toBeNull();
    expect(resolveImport('src/index.ts', '@nestjs/common', knownFiles)).toBeNull();
  });

  it('returns when exactly matching file exists', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', './utils.ts', knownFiles)).toBe('src/utils.ts');
  });

  it('resolves extensionless import to .ts', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', './utils', knownFiles)).toBe('src/utils.ts');
  });

  it('resolves extensionless import to .tsx', () => {
    const knownFiles = new Set(['src/Button.tsx']);
    expect(resolveImport('src/index.ts', './Button', knownFiles)).toBe('src/Button.tsx');
  });

  it('resolves extensionless import to .js', () => {
    const knownFiles = new Set(['src/helper.js']);
    expect(resolveImport('src/index.ts', './helper', knownFiles)).toBe('src/helper.js');
  });

  it('resolves extensionless import to .jsx', () => {
    const knownFiles = new Set(['src/component.jsx']);
    expect(resolveImport('src/index.ts', './component', knownFiles)).toBe('src/component.jsx');
  });

  it('resolves directory import to index.ts', () => {
    const knownFiles = new Set(['src/utils/index.ts']);
    expect(resolveImport('src/index.ts', './utils', knownFiles)).toBe('src/utils/index.ts');
  });

  it('resolves directory import to index.tsx', () => {
    const knownFiles = new Set(['src/components/index.tsx']);
    expect(resolveImport('src/index.ts', './components', knownFiles)).toBe(
      'src/components/index.tsx',
    );
  });

  it('resolves directory import to index.js', () => {
    const knownFiles = new Set(['src/lib/index.js']);
    expect(resolveImport('src/index.ts', './lib', knownFiles)).toBe('src/lib/index.js');
  });

  it('resolves directory import to index.jsx', () => {
    const knownFiles = new Set(['src/views/index.jsx']);
    expect(resolveImport('src/index.ts', './views', knownFiles)).toBe('src/views/index.jsx');
  });

  it('returns null for unresolvable imports', () => {
    const knownFiles = new Set(['src/other.ts']);
    expect(resolveImport('src/index.ts', './missing', knownFiles)).toBeNull();
  });

  it('handles absolute path imports starting with /', () => {
    const knownFiles = new Set(['src/lib/utils.ts']);
    expect(resolveImport('src/index.ts', '/lib/utils', knownFiles)).toBe('src/lib/utils.ts');
  });
});

describe('normalizePath', () => {
  it("handles '..' segments", () => {
    expect(normalizePath('src/deep/../utils')).toBe('src/utils');
  });

  it("removes '.' segments", () => {
    expect(normalizePath('src/./utils')).toBe('src/utils');
  });

  it('ignores empty segments', () => {
    expect(normalizePath('src//utils')).toBe('src/utils');
  });
});
