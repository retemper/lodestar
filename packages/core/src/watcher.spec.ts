import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RuleProviders, ModuleGraph } from '@retemper/lodestar-types';

// Mock fs.watch
const mockWatcher = {
  close: vi.fn(),
};
let watchCallback: (event: string, filename: string | null) => void;

vi.mock('node:fs', () => ({
  watch: vi.fn((_path: string, _opts: unknown, cb: typeof watchCallback) => {
    watchCallback = cb;
    return mockWatcher;
  }),
}));

vi.mock('./engine', () => ({
  run: vi.fn(),
  createProviders: vi.fn(),
}));

vi.mock('./incremental', () => ({
  computeImpactScope: vi.fn(),
}));

vi.mock('./logger', () => ({
  silentLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { watch } from 'node:fs';
import { run, createProviders } from './engine';
import { computeImpactScope } from './incremental';
import { createWatcher } from './watcher';
import type { RunSummary } from '@retemper/lodestar-types';

/** Creates a mock RunSummary */
function createMockSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    totalFiles: 0,
    totalRules: 3,
    violations: [],
    ruleResults: [],
    errorCount: 0,
    warnCount: 0,
    durationMs: 10,
    ...overrides,
  };
}

/** Creates a minimal mock graph */
function createMockGraph(): ModuleGraph {
  return { nodes: new Map() };
}

/** Creates mock providers with just enough for the watcher */
function createMockProviders(): RuleProviders {
  return {
    fs: { glob: vi.fn(), readFile: vi.fn(), exists: vi.fn(), readJson: vi.fn() },
    graph: {
      getDependencies: vi.fn(),
      getDependents: vi.fn(),
      hasCircular: vi.fn(),
      getModuleGraph: vi.fn().mockResolvedValue(createMockGraph()),
    },
    ast: {
      getSourceFile: vi.fn(),
      getImports: vi.fn(),
      getExports: vi.fn(),
    },
    config: {
      getPackageJson: vi.fn(),
      getTsConfig: vi.fn(),
      getCustomConfig: vi.fn(),
    },
  };
}

describe('createWatcher', () => {
  const mockRun = vi.mocked(run);
  const mockCreateProviders = vi.mocked(createProviders);
  const mockComputeImpactScope = vi.mocked(computeImpactScope);

  const baseConfig = {
    rootDir: '/project',
    plugins: [],
    rules: new Map(),
    scopedRules: [],
    baseline: null,
    reporters: [],
    adapters: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockRun.mockResolvedValue(createMockSummary());
    mockCreateProviders.mockReturnValue(createMockProviders());
    mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts']));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fs.watch를 recursive 모드로 시작한다', () => {
    const handle = createWatcher({ config: baseConfig });

    expect(watch).toHaveBeenCalledWith('/project', { recursive: true }, expect.any(Function));
    handle.close();
  });

  it('파일 변경 시 debounce 후 run을 호출한다', async () => {
    const handle = createWatcher({ config: baseConfig, debounceMs: 100 });

    watchCallback('change', 'src/a.ts');
    expect(mockRun).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: baseConfig,
        scope: expect.any(Set),
      }),
    );

    handle.close();
  });

  it('debounce 중 추가 변경이 있으면 하나로 합친다', async () => {
    const handle = createWatcher({ config: baseConfig, debounceMs: 100 });

    watchCallback('change', 'src/a.ts');
    await vi.advanceTimersByTimeAsync(50);
    watchCallback('change', 'src/b.ts');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockComputeImpactScope).toHaveBeenCalledWith(
      expect.arrayContaining(['src/a.ts', 'src/b.ts']),
      expect.anything(),
    );

    handle.close();
  });

  it('node_modules, .git 등 무시 패턴을 건너뛴다', async () => {
    const handle = createWatcher({ config: baseConfig, debounceMs: 50 });

    watchCallback('change', 'node_modules/pkg/index.js');
    watchCallback('change', '.git/HEAD');
    watchCallback('change', 'dist/index.js');

    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).not.toHaveBeenCalled();
    handle.close();
  });

  it('close() 호출 시 fs.watch를 닫는다', () => {
    const handle = createWatcher({ config: baseConfig });
    handle.close();

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
  });

  it('close() 후 파일 변경을 무시한다', async () => {
    const handle = createWatcher({ config: baseConfig, debounceMs: 50 });
    handle.close();

    watchCallback('change', 'src/a.ts');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('onCycle 콜백을 호출한다', async () => {
    const onCycle = vi.fn();
    mockRun.mockResolvedValue(createMockSummary({ errorCount: 2, warnCount: 1 }));
    mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts', 'src/b.ts']));

    const handle = createWatcher({ config: baseConfig, debounceMs: 50, onCycle });

    watchCallback('change', 'src/a.ts');
    await vi.advanceTimersByTimeAsync(50);
    // Wait for async run to complete
    await vi.advanceTimersByTimeAsync(0);

    expect(onCycle).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: ['src/a.ts'],
        scopeSize: 2,
        errorCount: 2,
        warnCount: 1,
      }),
    );

    handle.close();
  });

  it('filename이 null이면 무시한다', async () => {
    const handle = createWatcher({ config: baseConfig, debounceMs: 50 });

    watchCallback('change', null!);
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).not.toHaveBeenCalled();
    handle.close();
  });

  it('커스텀 ignore 패턴을 지원한다', async () => {
    const handle = createWatcher({
      config: baseConfig,
      debounceMs: 50,
      ignore: ['tmp', '.cache'],
    });

    watchCallback('change', 'tmp/debug.log');
    watchCallback('change', '.cache/data.json');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRun).not.toHaveBeenCalled();
    handle.close();
  });

  it('실행 중 에러가 발생해도 watcher가 중단되지 않는다', async () => {
    const mockLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    mockCreateProviders.mockImplementationOnce(() => {
      throw new Error('graph build failed');
    });

    const handle = createWatcher({ config: baseConfig, debounceMs: 50, logger: mockLogger });

    watchCallback('change', 'src/a.ts');
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('graph build failed'));

    // Watcher still works for next change
    mockCreateProviders.mockReturnValue(createMockProviders());

    watchCallback('change', 'src/b.ts');
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRun).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('기본 debounce는 300ms이다', async () => {
    const handle = createWatcher({ config: baseConfig });

    watchCallback('change', 'src/a.ts');

    await vi.advanceTimersByTimeAsync(200);
    expect(mockRun).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(mockRun).toHaveBeenCalledTimes(1);

    handle.close();
  });
});
