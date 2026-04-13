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
  describe('when astProvider or fsProvider is missing', () => {
    it('returns empty graph when both are missing', async () => {
      const provider = createGraphProvider('/root');
      const graph = await provider.getModuleGraph();

      expect(graph.nodes.size).toBe(0);
    });

    it('returns empty graph when only astProvider is missing', async () => {
      const fs = mockFSProvider();
      const provider = createGraphProvider('/root', undefined, fs);
      const deps = await provider.getDependencies('some.ts');

      expect(deps).toStrictEqual([]);
    });

    it('returns empty graph when only fsProvider is missing', async () => {
      const ast = mockASTProvider();
      const provider = createGraphProvider('/root', ast, undefined);
      const deps = await provider.getDependents('some.ts');

      expect(deps).toStrictEqual([]);
    });
  });

  describe('getDependencies', () => {
    it('returns dependency list of a file', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: ['B'],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('returns empty array for non-existent files', async () => {
      const ast = mockASTProvider();
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('nonexistent.ts');

      expect(deps).toStrictEqual([]);
    });
  });

  describe('getDependents', () => {
    it('returns list of files that import a file', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: ['B'],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
        'src/b.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const dependents = await provider.getDependents('src/b.ts');

      expect(dependents).toStrictEqual(['src/a.ts']);
    });

    it('returns empty array for files that nothing imports', async () => {
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
    it('returns true when circular dependency exists', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
        'src/b.ts': [
          {
            source: './a',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/b.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(true);
    });

    it('returns false when no circular dependency exists', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
        'src/b.ts': [],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(false);
    });

    it('does not revisit already visited nodes in diamond dependencies', async () => {
      const ast = mockASTProvider({
        'a.ts': [
          {
            source: './b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'a.ts' },
          },
          {
            source: './c',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'a.ts' },
          },
        ],
        'b.ts': [
          {
            source: './d',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'b.ts' },
          },
        ],
        'c.ts': [
          {
            source: './d',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'c.ts' },
          },
        ],
        'd.ts': [],
      });
      const fs = mockFSProvider(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('a.ts');

      expect(result).toBe(false);
    });

    it('returns false for entries not in the graph', async () => {
      const ast = mockASTProvider();
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('nonexistent.ts');

      expect(result).toBe(false);
    });

    it('detects indirect cycle of 3 files', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
        'src/b.ts': [
          {
            source: './c',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/b.ts' },
          },
        ],
        'src/c.ts': [
          {
            source: './a',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/c.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts', 'src/c.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const result = await provider.hasCircular('src/a.ts');

      expect(result).toBe(true);
    });
  });

  describe('getModuleGraph', () => {
    it('returns a graph containing nodes for all files', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
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

    it('caches the graph', async () => {
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

    it('includes tsx files too', async () => {
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

  describe('resolveImport (internal function test via public API)', () => {
    it('ignores non-relative imports', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: 'lodash',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual([]);
    });

    it('infers .tsx extension', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './App',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/App.tsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/App.tsx']);
    });

    it('infers .js extension', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './util',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/util.js']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/util.js']);
    });

    it('infers .jsx extension', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './Comp',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/Comp.jsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/Comp.jsx']);
    });

    it('infers index file', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './utils',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/utils/index.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/utils/index.ts']);
    });

    it('infers index.tsx file', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './components',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/components/index.tsx']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/components/index.tsx']);
    });

    it('ignores unresolvable relative imports', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './nonexistent',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual([]);
    });

    it('resolves exact file path with extension', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './b.ts',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('absolute path style imports are not resolved (normalizePath removes leading slash)', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: '/lib/util',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
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

  describe('normalizePath (internal function test via public API)', () => {
    it('resolves .. segments', async () => {
      const ast = mockASTProvider({
        'src/deep/a.ts': [
          {
            source: '../b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/deep/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/deep/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/deep/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('handles .. paths that go beyond root', async () => {
      const ast = mockASTProvider({
        'a.ts': [
          {
            source: '../b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
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

    it('correctly resolves multiple levels of ..', async () => {
      const ast = mockASTProvider({
        'src/deep/nested/a.ts': [
          {
            source: '../../b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/deep/nested/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/deep/nested/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/deep/nested/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('ignores empty segments (consecutive slashes)', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: './/b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
            location: { file: 'src/a.ts' },
          },
        ],
      });
      const fs = mockFSProvider(['src/a.ts', 'src/b.ts']);
      const provider = createGraphProvider('/root', ast, fs);

      const deps = await provider.getDependencies('src/a.ts');

      expect(deps).toStrictEqual(['src/b.ts']);
    });

    it('removes . segments', async () => {
      const ast = mockASTProvider({
        'src/a.ts': [
          {
            source: '././b',
            specifiers: [],
            isTypeOnly: false,
            kind: 'static',
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
