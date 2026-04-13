import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ModuleGraph, FileSystemProvider } from '@retemper/lodestar-types';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

import { computeImpactScope, createScopedFsProvider, getChangedFiles } from './incremental';

/** Helper to build a module graph for testing */
function makeGraph(defs: Record<string, { deps: string[]; dependents: string[] }>): ModuleGraph {
  const nodes = new Map(
    Object.entries(defs).map(([id, { deps, dependents }]) => [
      id,
      { id, dependencies: deps, dependents },
    ]),
  );
  return { nodes };
}

describe('computeImpactScope', () => {
  it('includes changed files', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('a.ts')).toBe(true);
  });

  it('includes direct dependents of changed files', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('a.ts')).toBe(true);
    expect(scope.has('b.ts')).toBe(true);
  });

  it('recursively includes indirect dependents', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: ['c.ts'] },
      'c.ts': { deps: ['b.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('c.ts')).toBe(true);
    expect(scope.size).toBe(3);
  });

  it('includes changed files not in graph in scope', () => {
    const graph = makeGraph({});

    const scope = computeImpactScope(['new-file.ts'], graph);

    expect(scope.has('new-file.ts')).toBe(true);
  });

  it('does not fall into infinite loop on circular dependencies', () => {
    const graph = makeGraph({
      'a.ts': { deps: ['b.ts'], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: ['a.ts'] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.size).toBe(2);
  });

  it('does not process duplicates when same file is queued via multiple paths', () => {
    // Both a.ts and b.ts changed, and both have dependent c.ts
    // c.ts gets queued twice (from a.ts and b.ts processing)
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['c.ts'] },
      'b.ts': { deps: [], dependents: ['c.ts'] },
      'c.ts': { deps: ['a.ts', 'b.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts', 'b.ts'], graph);

    expect(scope.size).toBe(3);
    expect(scope.has('c.ts')).toBe(true);
  });

  it('merges impact scope of multiple changed files', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['c.ts'] },
      'b.ts': { deps: [], dependents: ['d.ts'] },
      'c.ts': { deps: ['a.ts'], dependents: [] },
      'd.ts': { deps: ['b.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts', 'b.ts'], graph);

    expect(scope.size).toBe(4);
  });
});

describe('createScopedFsProvider', () => {
  it('filters glob results to files within scope', async () => {
    const base: FileSystemProvider = {
      async glob() {
        return ['a.ts', 'b.ts', 'c.ts'];
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

    const scoped = createScopedFsProvider(base, new Set(['a.ts', 'c.ts']));
    const result = await scoped.glob('**/*.ts');

    expect(result).toStrictEqual(['a.ts', 'c.ts']);
  });

  it('returns empty array when scope is empty', async () => {
    const base: FileSystemProvider = {
      async glob() {
        return ['a.ts'];
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

    const scoped = createScopedFsProvider(base, new Set());
    const result = await scoped.glob('**/*.ts');

    expect(result).toStrictEqual([]);
  });

  it('uses original provider for other methods', async () => {
    const base: FileSystemProvider = {
      async glob() {
        return [];
      },
      async readFile() {
        return 'content';
      },
      async exists() {
        return true;
      },
      async readJson() {
        return { key: 'value' } as never;
      },
    };

    const scoped = createScopedFsProvider(base, new Set());

    expect(await scoped.readFile('any')).toBe('content');
    expect(await scoped.exists('any')).toBe(true);
  });
});

describe('getChangedFiles', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('runs git diff base...HEAD when base ref is given', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'src/a.ts\nsrc/b.ts\n' });

    const result = await getChangedFiles('/root', 'main');

    expect(mockExecFile).toHaveBeenCalledWith('git', ['diff', '--name-only', 'main...HEAD'], {
      cwd: '/root',
    });
    expect(result).toStrictEqual(['src/a.ts', 'src/b.ts']);
  });

  it('combines unstaged, staged, and untracked when base ref is absent', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'src/unstaged.ts\n' })
      .mockResolvedValueOnce({ stdout: 'src/staged.ts\n' })
      .mockResolvedValueOnce({ stdout: 'src/new.ts\n' });

    const result = await getChangedFiles('/root');

    expect(mockExecFile).toHaveBeenCalledTimes(3);
    expect(mockExecFile).toHaveBeenCalledWith('git', ['diff', '--name-only'], { cwd: '/root' });
    expect(mockExecFile).toHaveBeenCalledWith('git', ['diff', '--name-only', '--cached'], {
      cwd: '/root',
    });
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: '/root' },
    );
    expect(result).toHaveLength(3);
    expect(result).toContain('src/unstaged.ts');
    expect(result).toContain('src/staged.ts');
    expect(result).toContain('src/new.ts');
  });

  it('removes duplicate files', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'src/a.ts\n' })
      .mockResolvedValueOnce({ stdout: 'src/a.ts\n' })
      .mockResolvedValueOnce({ stdout: '' });

    const result = await getChangedFiles('/root');

    expect(result).toStrictEqual(['src/a.ts']);
  });

  it('returns empty array for empty output', async () => {
    mockExecFile.mockResolvedValue({ stdout: '' });

    const result = await getChangedFiles('/root', 'main');

    expect(result).toStrictEqual([]);
  });

  it('ignores blank lines', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'src/a.ts\n\n\nsrc/b.ts\n' });

    const result = await getChangedFiles('/root', 'main');

    expect(result).toStrictEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns empty array when all commands output empty without base', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' });

    const result = await getChangedFiles('/root');

    expect(result).toStrictEqual([]);
  });
});
