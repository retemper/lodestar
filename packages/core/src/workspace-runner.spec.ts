import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunSummary } from '@retemper/types';
import type { WorkspacePackage } from '@retemper/config';

vi.mock('@retemper/config', () => ({
  discoverWorkspaces: vi.fn(),
  loadConfigFile: vi.fn(),
  resolveConfig: vi.fn(),
}));

vi.mock('./engine', () => ({
  run: vi.fn(),
}));

import { discoverWorkspaces, loadConfigFile, resolveConfig } from '@retemper/config';
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

    mockResolveConfig.mockReturnValue({
      rootDir: '/root',
      plugins: [],
      rules: new Map(),
      scopedRules: [],
      baseline: null,
      adapters: [],
    });

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
});
