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
  it('변경 파일을 포함한다', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('a.ts')).toBe(true);
  });

  it('변경 파일의 직접 의존자를 포함한다', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('a.ts')).toBe(true);
    expect(scope.has('b.ts')).toBe(true);
  });

  it('간접 의존자를 재귀적으로 포함한다', () => {
    const graph = makeGraph({
      'a.ts': { deps: [], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: ['c.ts'] },
      'c.ts': { deps: ['b.ts'], dependents: [] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.has('c.ts')).toBe(true);
    expect(scope.size).toBe(3);
  });

  it('그래프에 없는 변경 파일도 scope에 포함한다', () => {
    const graph = makeGraph({});

    const scope = computeImpactScope(['new-file.ts'], graph);

    expect(scope.has('new-file.ts')).toBe(true);
  });

  it('순환 의존성에서 무한 루프에 빠지지 않는다', () => {
    const graph = makeGraph({
      'a.ts': { deps: ['b.ts'], dependents: ['b.ts'] },
      'b.ts': { deps: ['a.ts'], dependents: ['a.ts'] },
    });

    const scope = computeImpactScope(['a.ts'], graph);

    expect(scope.size).toBe(2);
  });

  it('같은 파일이 여러 경로로 큐에 추가되면 중복 처리하지 않는다', () => {
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

  it('여러 변경 파일의 영향 범위를 합친다', () => {
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
  it('glob 결과를 scope 내 파일로 필터링한다', async () => {
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

  it('scope가 비어있으면 빈 배열을 반환한다', async () => {
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

  it('다른 메서드는 원본 provider를 사용한다', async () => {
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

  it('base ref가 주어지면 git diff base...HEAD를 실행한다', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'src/a.ts\nsrc/b.ts\n' });

    const result = await getChangedFiles('/root', 'main');

    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', 'main...HEAD'],
      { cwd: '/root' },
    );
    expect(result).toStrictEqual(['src/a.ts', 'src/b.ts']);
  });

  it('base ref가 없으면 unstaged, staged, untracked를 합친다', async () => {
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

  it('중복 파일을 제거한다', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'src/a.ts\n' })
      .mockResolvedValueOnce({ stdout: 'src/a.ts\n' })
      .mockResolvedValueOnce({ stdout: '' });

    const result = await getChangedFiles('/root');

    expect(result).toStrictEqual(['src/a.ts']);
  });

  it('빈 출력이면 빈 배열을 반환한다', async () => {
    mockExecFile.mockResolvedValue({ stdout: '' });

    const result = await getChangedFiles('/root', 'main');

    expect(result).toStrictEqual([]);
  });

  it('빈 줄을 무시한다', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'src/a.ts\n\n\nsrc/b.ts\n' });

    const result = await getChangedFiles('/root', 'main');

    expect(result).toStrictEqual(['src/a.ts', 'src/b.ts']);
  });

  it('base 없이 모든 명령이 빈 출력이면 빈 배열을 반환한다', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' });

    const result = await getChangedFiles('/root');

    expect(result).toStrictEqual([]);
  });
});
