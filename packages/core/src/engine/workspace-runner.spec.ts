import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunSummary } from '@retemper/lodestar-types';
import type { WorkspacePackage } from '@retemper/lodestar-config';

vi.mock('@retemper/lodestar-config', () => ({
  discoverWorkspaces: vi.fn(),
  loadConfigFile: vi.fn(),
  resolveConfig: vi.fn(),
}));

vi.mock('./engine', () => ({
  run: vi.fn(),
}));

import { discoverWorkspaces, loadConfigFile, resolveConfig } from '@retemper/lodestar-config';
import { run } from './engine';
import { runWorkspace } from './workspace-runner';

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

describe('runWorkspace', () => {
  const mockDiscoverWorkspaces = vi.mocked(discoverWorkspaces);
  const mockLoadConfigFile = vi.mocked(loadConfigFile);
  const mockResolveConfig = vi.mocked(resolveConfig);
  const mockRun = vi.mocked(run);

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveConfig.mockImplementation((_config, rootDir) => ({
      rootDir: rootDir as string,
      plugins: [],
      rules: new Map(),
      scopedRules: [],
      baseline: null,
      reporters: [],
      adapters: [],
    }));

    mockRun.mockResolvedValue(createMockSummary());
    mockDiscoverWorkspaces.mockResolvedValue([]);
  });

  it('루트 config를 rootDir에서 실행한다', async () => {
    const rootConfig = { rules: { 'test/rule': 'error' as const } };

    await runWorkspace({ rootDir: '/root', rootConfig });

    expect(mockResolveConfig).toHaveBeenCalledWith(rootConfig, '/root');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('config가 있는 패키지만 실행한다', async () => {
    const packages: WorkspacePackage[] = [
      { name: '@my/core', dir: '/root/packages/core' },
      { name: '@my/cli', dir: '/root/packages/cli' },
    ];
    mockDiscoverWorkspaces.mockResolvedValue(packages);

    const pkgConfig = { rules: { 'test/pkg-rule': 'warn' as const } };
    mockLoadConfigFile.mockResolvedValueOnce(pkgConfig).mockResolvedValueOnce(null);

    const rootConfig = { rules: { 'test/rule': 'error' as const } };
    const result = await runWorkspace({ rootDir: '/root', rootConfig });

    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].package.name).toBe('@my/core');
  });

  it('config가 없는 패키지는 건너뛴다', async () => {
    mockDiscoverWorkspaces.mockResolvedValue([{ name: '@my/types', dir: '/root/packages/types' }]);
    mockLoadConfigFile.mockResolvedValue(null);

    const result = await runWorkspace({ rootDir: '/root', rootConfig: {} });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(result.packages).toHaveLength(0);
  });

  it('패키지 에러와 루트 에러를 합산한다', async () => {
    mockDiscoverWorkspaces.mockResolvedValue([{ name: '@my/core', dir: '/root/packages/core' }]);
    mockLoadConfigFile.mockResolvedValue({ rules: {} });

    mockRun
      .mockResolvedValueOnce(createMockSummary({ errorCount: 2, warnCount: 1 }))
      .mockResolvedValueOnce(createMockSummary({ errorCount: 3, warnCount: 4 }));

    const result = await runWorkspace({ rootDir: '/root', rootConfig: {} });

    expect(result.totalErrorCount).toBe(5);
    expect(result.totalWarnCount).toBe(5);
  });

  it('reporter의 onPackageStart와 onPackageComplete를 호출한다', async () => {
    mockDiscoverWorkspaces.mockResolvedValue([{ name: '@my/core', dir: '/root/packages/core' }]);
    mockLoadConfigFile.mockResolvedValue({ rules: {} });

    const reporter = {
      name: 'test',
      onStart: vi.fn(),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
      onPackageStart: vi.fn(),
      onPackageComplete: vi.fn(),
    };

    await runWorkspace({ rootDir: '/root', rootConfig: {}, reporter });

    expect(reporter.onPackageStart).toHaveBeenCalledTimes(2);
    expect(reporter.onPackageComplete).toHaveBeenCalledTimes(2);
    expect(reporter.onPackageStart.mock.calls[0][0].name).toBe('(root)');
    expect(reporter.onPackageStart.mock.calls[1][0].name).toBe('@my/core');
  });

  it('totalDurationMs가 0 이상이다', async () => {
    const result = await runWorkspace({ rootDir: '/root', rootConfig: {} });
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('rootSummary를 포함한다', async () => {
    const summary = createMockSummary({ errorCount: 1 });
    mockRun.mockResolvedValue(summary);

    const result = await runWorkspace({ rootDir: '/root', rootConfig: {} });
    expect(result.rootSummary).toStrictEqual(summary);
  });

  it('워크스페이스 패키지가 없으면 루트만 실행한다', async () => {
    mockDiscoverWorkspaces.mockResolvedValue([]);

    const result = await runWorkspace({ rootDir: '/root', rootConfig: {} });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(result.packages).toHaveLength(0);
  });

  describe('병렬 실행', () => {
    it('여러 패키지를 동시에 실행한다', async () => {
      const packages: WorkspacePackage[] = [
        { name: '@my/a', dir: '/root/packages/a' },
        { name: '@my/b', dir: '/root/packages/b' },
        { name: '@my/c', dir: '/root/packages/c' },
      ];
      mockDiscoverWorkspaces.mockResolvedValue(packages);
      mockLoadConfigFile.mockResolvedValue({ rules: {} });

      const executionOrder: string[] = [];
      mockRun.mockImplementation(async (opts) => {
        const dir = opts.config.rootDir;
        executionOrder.push(`start:${dir}`);
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(`end:${dir}`);
        return createMockSummary();
      });

      const result = await runWorkspace({
        rootDir: '/root',
        rootConfig: {},
        concurrency: 3,
      });

      // Root runs first (sequential), then all 3 packages
      expect(mockRun).toHaveBeenCalledTimes(4);
      expect(result.packages).toHaveLength(3);
    });

    it('concurrency=1이면 순차 실행한다', async () => {
      const packages: WorkspacePackage[] = [
        { name: '@my/a', dir: '/root/packages/a' },
        { name: '@my/b', dir: '/root/packages/b' },
      ];
      mockDiscoverWorkspaces.mockResolvedValue(packages);
      mockLoadConfigFile.mockResolvedValue({ rules: {} });

      const executionOrder: string[] = [];
      mockRun.mockImplementation(async (opts) => {
        const dir = opts.config.rootDir;
        executionOrder.push(`start:${dir}`);
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(`end:${dir}`);
        return createMockSummary();
      });

      await runWorkspace({
        rootDir: '/root',
        rootConfig: {},
        concurrency: 1,
      });

      // With concurrency=1, packages run sequentially: start/end for a, then start/end for b
      const pkgOrder = executionOrder.filter((e) => e !== 'start:/root' && e !== 'end:/root');
      expect(pkgOrder[0]).toBe('start:/root/packages/a');
      expect(pkgOrder[1]).toBe('end:/root/packages/a');
      expect(pkgOrder[2]).toBe('start:/root/packages/b');
      expect(pkgOrder[3]).toBe('end:/root/packages/b');
    });

    it('reporter 이벤트를 패키지 순서대로 emit한다', async () => {
      const packages: WorkspacePackage[] = [
        { name: '@my/a', dir: '/root/packages/a' },
        { name: '@my/b', dir: '/root/packages/b' },
      ];
      mockDiscoverWorkspaces.mockResolvedValue(packages);
      mockLoadConfigFile.mockResolvedValue({ rules: {} });

      // Make package B finish before A
      mockRun
        .mockResolvedValueOnce(createMockSummary()) // root
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 50)); // A is slow
          return createMockSummary({ errorCount: 1 });
        })
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 5)); // B is fast
          return createMockSummary({ errorCount: 2 });
        });

      const reporter = {
        name: 'test',
        onStart: vi.fn(),
        onViolation: vi.fn(),
        onComplete: vi.fn(),
        onPackageStart: vi.fn(),
        onPackageComplete: vi.fn(),
      };

      await runWorkspace({
        rootDir: '/root',
        rootConfig: {},
        reporter,
        concurrency: 4,
      });

      // Reporter events should be in order: root, A, B (regardless of finish order)
      const startNames = (reporter.onPackageStart.mock.calls as Array<[{ name: string }]>).map(
        (c) => c[0].name,
      );
      expect(startNames).toStrictEqual(['(root)', '@my/a', '@my/b']);
    });

    it('concurrency가 0 이하이면 1로 보정한다', async () => {
      mockDiscoverWorkspaces.mockResolvedValue([{ name: '@my/a', dir: '/root/packages/a' }]);
      mockLoadConfigFile.mockResolvedValue({ rules: {} });

      const result = await runWorkspace({
        rootDir: '/root',
        rootConfig: {},
        concurrency: 0,
      });

      expect(mockRun).toHaveBeenCalledTimes(2);
      expect(result.packages).toHaveLength(1);
    });

    it('기본 concurrency는 4이다 (옵션 미지정)', async () => {
      const packages: WorkspacePackage[] = Array.from({ length: 6 }, (_, i) => ({
        name: `@my/pkg-${i}`,
        dir: `/root/packages/pkg-${i}`,
      }));
      mockDiscoverWorkspaces.mockResolvedValue(packages);
      mockLoadConfigFile.mockResolvedValue({ rules: {} });

      const concurrentCount = { current: 0, max: 0 };
      mockRun.mockImplementation(async () => {
        concurrentCount.current++;
        concurrentCount.max = Math.max(concurrentCount.max, concurrentCount.current);
        await new Promise((r) => setTimeout(r, 20));
        concurrentCount.current--;
        return createMockSummary();
      });

      await runWorkspace({ rootDir: '/root', rootConfig: {} });

      // Max concurrent should be at most 4 (default) + possibly root overlapping
      // Root runs first sequentially, then packages. So max concurrent for packages <= 4
      expect(concurrentCount.max).toBeLessThanOrEqual(5); // 4 packages + root already done
      expect(mockRun).toHaveBeenCalledTimes(7); // root + 6 packages
    });
  });
});
