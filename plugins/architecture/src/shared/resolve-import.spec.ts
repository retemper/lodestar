import { describe, it, expect } from 'vitest';
import { resolveImport, normalizePath } from './resolve-import';

describe('resolveImport', () => {
  it('npm 패키지(비상대 경로)는 null을 반환한다', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', 'lodash', knownFiles)).toBeNull();
    expect(resolveImport('src/index.ts', '@nestjs/common', knownFiles)).toBeNull();
  });

  it('정확히 일치하는 파일이 있으면 반환한다', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', './utils.ts', knownFiles)).toBe('src/utils.ts');
  });

  it('확장자 없는 import를 .ts로 해결한다', () => {
    const knownFiles = new Set(['src/utils.ts']);
    expect(resolveImport('src/index.ts', './utils', knownFiles)).toBe('src/utils.ts');
  });

  it('확장자 없는 import를 .tsx로 해결한다', () => {
    const knownFiles = new Set(['src/Button.tsx']);
    expect(resolveImport('src/index.ts', './Button', knownFiles)).toBe('src/Button.tsx');
  });

  it('확장자 없는 import를 .js로 해결한다', () => {
    const knownFiles = new Set(['src/helper.js']);
    expect(resolveImport('src/index.ts', './helper', knownFiles)).toBe('src/helper.js');
  });

  it('확장자 없는 import를 .jsx로 해결한다', () => {
    const knownFiles = new Set(['src/component.jsx']);
    expect(resolveImport('src/index.ts', './component', knownFiles)).toBe('src/component.jsx');
  });

  it('디렉토리 import를 index.ts로 해결한다', () => {
    const knownFiles = new Set(['src/utils/index.ts']);
    expect(resolveImport('src/index.ts', './utils', knownFiles)).toBe('src/utils/index.ts');
  });

  it('디렉토리 import를 index.tsx로 해결한다', () => {
    const knownFiles = new Set(['src/components/index.tsx']);
    expect(resolveImport('src/index.ts', './components', knownFiles)).toBe(
      'src/components/index.tsx',
    );
  });

  it('디렉토리 import를 index.js로 해결한다', () => {
    const knownFiles = new Set(['src/lib/index.js']);
    expect(resolveImport('src/index.ts', './lib', knownFiles)).toBe('src/lib/index.js');
  });

  it('디렉토리 import를 index.jsx로 해결한다', () => {
    const knownFiles = new Set(['src/views/index.jsx']);
    expect(resolveImport('src/index.ts', './views', knownFiles)).toBe('src/views/index.jsx');
  });

  it('해결할 수 없는 import는 null을 반환한다', () => {
    const knownFiles = new Set(['src/other.ts']);
    expect(resolveImport('src/index.ts', './missing', knownFiles)).toBeNull();
  });

  it('/로 시작하는 절대 경로 import를 처리한다', () => {
    const knownFiles = new Set(['src/lib/utils.ts']);
    expect(resolveImport('src/index.ts', '/lib/utils', knownFiles)).toBe('src/lib/utils.ts');
  });
});

describe('normalizePath', () => {
  it("'..' 세그먼트를 처리한다", () => {
    expect(normalizePath('src/deep/../utils')).toBe('src/utils');
  });

  it("'.' 세그먼트를 제거한다", () => {
    expect(normalizePath('src/./utils')).toBe('src/utils');
  });

  it('빈 세그먼트를 무시한다', () => {
    expect(normalizePath('src//utils')).toBe('src/utils');
  });
});
