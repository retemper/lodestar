import { describe, it, expect, vi } from 'vitest';
import type { ASTProvider, FileSystemProvider, ImportInfo } from '@retemper/lodestar-types';
import { createGraphProvider } from './graph';

/** Creates a mock ASTProvider for testing */
function mockASTProvider(importMap: Record<string, readonly ImportInfo[]> = {}): ASTProvider {
  return {
    async getSourceFile(_path: string) {
      return { type: 'Module', body: [] };
    },
    async getImports(path: string) {
      return importMap[path] ?? [];
    },
    async getExports() {
      return [];
    },
  };
}

/** Creates a mock FileSystemProvider for testing */
function mockFSProvider(
  tsFiles: readonly string[] = [],
  tsxFiles: readonly string[] = [],
): FileSystemProvider {
  return {
    async glob(pattern: string) {
      if (pattern === '**/*.tsx') return tsxFiles;
      return tsFiles;
    },
    async readFile() {
      return '';
    },
    async exists() {
      return true;
    },
    async readJson() {
      return {} as never;
    },
  };
}

describe('createGraphProvider', () => {
  describe('astProvider 또는 fsProvider가 없을 때', () => {
    it('둘 다 없으면 빈 그래프를 반환한다', async () => {
      const provider = createGraphProvider('/root');
      const graph = await provider.getModuleGraph();

      expect(graph.nodes.size).toBe(0);
    });

    it('astProvider만 없으면 빈 그래프를 반환한다', async () => {
      const fs = mockFSProvider();
      const provider = createGraphProvider('/root', undefined, fs);
      const deps = await provider.getDependencies('some.ts');

      expect(deps).toStrictEqual([]);
    });

    it('fsProvider만 없으면 빈 그래프를 반환한다', async () => {
      const ast = mockASTProvider();
      const provider = createGraphProvider('/root', ast, undefined);
      const deps = await provider.getDependents('some.ts');

      expect(deps).toStrictEqual([]);
    });
  });

  describe('getDependencies', () => {
    it('파일의 의존성 목록을 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: ['B'], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('존재하지 않는 파일은 빈 배열을 반환한다', async () => {
      const ast = mockASTProvider();
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('nonexistent.ts');

      expect(deps).toStrictEqual([]);
    });
  });

  describe('getDependents', () => {
    it('파일을 import하는 파일 목록을 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: ['B'], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
        'src/b.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const dependents = await provider.getDependents('src/b.ts');

      expect(dependents).toStrictEqual(['src/a.ts']);
    });

    it('아무도 import하지 않는 파일은 빈 배열을 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const dependents = await provider.getDependents('src/a.ts');

      expect(dependents).toStrictEqual([]);
    });
  });

  describe('hasCircular', () => {
    it('순환 의존성이 있으면 true를 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
        'src/b.ts': [
          { source: './a', specifiers: [], isTypeOnly: false, location: { file: 'src/b.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(true);
    });

    it('순환 의존성이 없으면 false를 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
        'src/b.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(false);
    });

    it('다이아몬드 의존성에서 이미 방문한 노드를 재탐색하지 않는다', async () => {
      const ast = mockASTProvider({
        'a.ts': [
          { source: './b', specifiers: [], isTypeOnly: false, location: { file: 'a.ts' } },
          { source: './c', specifiers: [], isTypeOnly: false, location: { file: 'a.ts' } },
        ],
        'b.ts': [{ source: './d', specifiers: [], isTypeOnly: false, location: { file: 'b.ts' } }],
        'c.ts': [{ source: './d', specifiers: [], isTypeOnly: false, location: { file: 'c.ts' } }],
        'd.ts': [],
      });
      const fs = mockFSProvider(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('a.ts');

      expect(result).toBe(false);
    });

    it('그래프에 없는 엔트리는 false를 반환한다', async () => {
      const ast = mockASTProvider();
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('nonexistent.ts');

      expect(result).toBe(false);
    });

    it('3개 파일의 간접 순환을 감지한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
        'src/b.ts': [
          { source: './c', specifiers: [], isTypeOnly: false, location: { file: 'src/b.ts' } },
        ],
        'src/c.ts': [
          { source: './a', specifiers: [], isTypeOnly: false, location: { file: 'src/c.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts', 'src/c.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(true);
    });
  });

  describe('getModuleGraph', () => {
    it('모든 파일의 노드를 포함하는 그래프를 반환한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './b', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
        'src/b.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const graph = await provider.getModuleGraph();

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get('src/a.ts')?.dependencies).toStrictEqual(['src/b.ts']);
      expect(graph.nodes.get('src/b.ts')?.dependents).toStrictEqual(['src/a.ts']);
    });

    it('그래프를 캐시한다', async () => {
      const globFn = vi
        .fn()
        .mockResolvedValueOnce(['src/a.ts'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['src/a.ts'])
        .mockResolvedValueOnce([]);
      const fs: FileSystemProvider = {
        glob: globFn,
        async readFile() {
          return '';
        },
        async exists() {
          return true;
        },
        async readJson() {
          return {} as never;
        },
      };
      const ast = mockASTProvider({ 'src/a.ts': [] });
      const provider = createGraphProvider('/root', ast, fs);

      await provider.getModuleGraph();
      await provider.getModuleGraph();

      expect(globFn).toHaveBeenCalledTimes(2);
    });

    it('tsx 파일도 포함한다', async () => {
      const ast = mockASTProvider({
        'src/App.tsx': [],
        'src/utils.ts': [],
      });
      const fs = mockFSProvider(['src/utils.ts'], ['src/App.tsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const graph = await provider.getModuleGraph();

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.has('src/App.tsx')).toBe(true);
      expect(graph.nodes.has('src/utils.ts')).toBe(true);
    });
  });

  describe('resolveImport (공개 API를 통한 내부 함수 테스트)', () => {
    it('비상대 import는 무시한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: 'lodash', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual([]);
    });

    it('.tsx 확장자를 추론한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './App', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/App.tsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/App.tsx']);
    });

    it('.js 확장자를 추론한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './util', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/util.js']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/util.js']);
    });

    it('.jsx 확장자를 추론한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './Comp', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/Comp.jsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/Comp.jsx']);
    });

    it('index 파일을 추론한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          { source: './utils', specifiers: [], isTypeOnly: false, location: { file: 'src/a.ts' } },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/utils/index.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/utils/index.ts']);
    });

    it('index.tsx 파일을 추론한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './components',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/components/index.tsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/components/index.tsx']);
    });

    it('해석할 수 없는 상대 import는 무시한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './nonexistent',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual([]);
    });

    it('확장자가 있는 정확한 파일 경로를 해석한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b.ts',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('절대 경로 스타일 import는 해석되지 않는다 (normalizePath가 선행 슬래시를 제거)', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: '/lib/util',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/lib/util.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/lib/util.ts']);
    });
  });

  describe('normalizePath (공개 API를 통한 내부 함수 테스트)', () => {
    it('.. 세그먼트를 해석한다', async () => {
      const ast = mockASTProvider({
        'src/deep/a.ts': [
          {
            source: '../b',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/deep/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/deep/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/deep/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('루트를 넘어가는 .. 경로도 처리한다', async () => {
      const ast = mockASTProvider({
        'a.ts': [
          {
            source: '../b',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['a.ts', 'b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('a.ts');

      // ../b from 'a.ts' -> dirname is '', join is '../b', normalizePath pops empty -> 'b'
      expect(deps).toStrictEqual(['b.ts']);
    });

    it('여러 단계의 .. 를 정상적으로 해석한다', async () => {
      const ast = mockASTProvider({
        'src/deep/nested/a.ts': [
          {
            source: '../../b',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/deep/nested/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/deep/nested/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/deep/nested/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('빈 세그먼트를 무시한다 (연속 슬래시)', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './/b',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('. 세그먼트를 제거한다', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: '././b',
            specifiers: [],
            isTypeOnly: false,
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });
  });
});
