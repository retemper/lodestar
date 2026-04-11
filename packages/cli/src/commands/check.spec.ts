import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RunSummary, WorkspaceSummary, WrittenConfig } from '@retemper/lodestar';

/** Creates a test logger that delegates to console.error (spied in beforeEach) */
function createMockLogger() {
  return {
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  };
}

vi.mock('@retemper/lodestar', () => ({
  loadConfigFile: vi.fn(),
  discoverWorkspaces: vi.fn(),
  resolveConfig: vi.fn(() => ({
    rootDir: '/fake',
    plugins: [],
    rules: new Map(),
    scopedRules: [],
    baseline: null,
    adapters: [],
    reporters: [],
  })),
  run: vi.fn(),
  runWorkspace: vi.fn(),
  createCompositeReporter: vi.fn((reporters: readonly unknown[]) => reporters[0]),
  createDiskCacheProvider: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
  createLogger: vi.fn(() => createMockLogger()),
  getChangedFiles: vi.fn(),
  computeImpactScope: vi.fn(),
  createProviders: vi.fn(),
}));

vi.mock('../reporters/console', () => ({
  createConsoleReporter: vi.fn(() => ({
    name: 'console',
    onStart: vi.fn(),
    onRuleStart: vi.fn(),
    onRuleComplete: vi.fn(),
    onViolation: vi.fn(),
    onComplete: vi.fn(),
    onPackageStart: vi.fn(),
    onPackageComplete: vi.fn(),
  })),
}));

vi.mock('../reporters/json', () => ({
  createJsonReporter: vi.fn(() => ({
    name: 'json',
    onStart: vi.fn(),
    onRuleStart: vi.fn(),
    onRuleComplete: vi.fn(),
    onViolation: vi.fn(),
    onComplete: vi.fn(),
    onPackageStart: vi.fn(),
    onPackageComplete: vi.fn(),
  })),
}));

vi.mock('@retemper/lodestar-reporter-sarif', () => ({
  createSarifReporter: vi.fn(() => ({
    name: 'sarif',
    onStart: vi.fn(),
    onRuleStart: vi.fn(),
    onRuleComplete: vi.fn(),
    onViolation: vi.fn(),
    onComplete: vi.fn(),
    onPackageStart: vi.fn(),
    onPackageComplete: vi.fn(),
  })),
}));

vi.mock('@retemper/lodestar-reporter-junit', () => ({
  createJunitReporter: vi.fn(() => ({
    name: 'junit',
    onStart: vi.fn(),
    onRuleStart: vi.fn(),
    onRuleComplete: vi.fn(),
    onViolation: vi.fn(),
    onComplete: vi.fn(),
    onPackageStart: vi.fn(),
    onPackageComplete: vi.fn(),
  })),
}));

import { checkCommand } from './check';
import {
  createCompositeReporter,
  createDiskCacheProvider,
  createProviders,
  computeImpactScope,
  discoverWorkspaces,
  getChangedFiles,
  loadConfigFile,
  run,
  runWorkspace,
} from '@retemper/lodestar';
import { createSarifReporter } from '@retemper/lodestar-reporter-sarif';
import { createJunitReporter } from '@retemper/lodestar-reporter-junit';

const mockLoadConfigFile = vi.mocked(loadConfigFile);
const mockDiscoverWorkspaces = vi.mocked(discoverWorkspaces);
const mockRun = vi.mocked(run);
const mockRunWorkspace = vi.mocked(runWorkspace);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockComputeImpactScope = vi.mocked(computeImpactScope);
const mockCreateProviders = vi.mocked(createProviders);

/** Create a minimal RunSummary for testing */
function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    totalFiles: 0,
    totalRules: 0,
    violations: [],
    ruleResults: [],
    errorCount: 0,
    warnCount: 0,
    durationMs: 0,
    ...overrides,
  };
}

/** Create a minimal WorkspaceSummary for testing */
function makeWorkspaceSummary(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return {
    rootSummary: makeSummary(),
    packages: [],
    totalErrorCount: 0,
    totalWarnCount: 0,
    totalDurationMs: 0,
    ...overrides,
  };
}

/** Minimal WrittenConfig fixture */
const stubConfig: WrittenConfig = { plugins: [], rules: {} };

describe('checkCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;

    mockLoadConfigFile.mockResolvedValue(null);
    mockDiscoverWorkspaces.mockResolvedValue([]);
    mockRun.mockResolvedValue(makeSummary());
    mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('설정 파일이 없는 경우', () => {
    it('에러 메시지를 출력하고 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No lodestar.config.ts found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('run이나 runWorkspace를 호출하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockRunWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('단일 프로젝트 모드', () => {
    it('워크스페이스가 없으면 run을 호출한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRunWorkspace).not.toHaveBeenCalled();
    });

    it('에러가 없으면 exitCode를 설정하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 0, warnCount: 3 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBeUndefined();
    });

    it('에러가 있으면 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 2 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBe(1);
    });
  });

  describe('워크스페이스 모드', () => {
    it('워크스페이스가 감지되면 runWorkspace를 호출한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRunWorkspace).toHaveBeenCalledTimes(1);
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('--workspace 플래그가 true이면 워크스페이스 모드를 강제한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console', workspace: true });

      expect(mockRunWorkspace).toHaveBeenCalledTimes(1);
      expect(mockDiscoverWorkspaces).not.toHaveBeenCalled();
    });

    it('--workspace 플래그가 false이면 단일 프로젝트 모드를 강제한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console', workspace: false });

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRunWorkspace).not.toHaveBeenCalled();
      expect(mockDiscoverWorkspaces).not.toHaveBeenCalled();
    });

    it('워크스페이스 모드에서 에러가 있으면 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary({ totalErrorCount: 5 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBe(1);
    });

    it('워크스페이스 모드에서 경고만 있으면 exitCode를 설정하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(
        makeWorkspaceSummary({
          totalErrorCount: 0,
          totalWarnCount: 7,
        }),
      );

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBeUndefined();
    });

    it('워크스페이스 모드에서 총 소요 시간을 포함하여 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(
        makeWorkspaceSummary({
          packages: [],
          totalErrorCount: 0,
          totalWarnCount: 0,
          totalDurationMs: 42.7,
        }),
      );

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const totalLine = calls.find((c) => c.includes('Total:'));
      expect(totalLine).toContain('43ms');
    });

    it('패키지 수를 포함한 합계 메시지를 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(
        makeWorkspaceSummary({
          packages: [
            {
              package: { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
              summary: makeSummary(),
            },
            {
              package: { name: '@retemper/lodestar-cli', dir: '/fake/packages/cli' },
              summary: makeSummary(),
            },
          ],
          totalErrorCount: 1,
          totalWarnCount: 2,
          totalDurationMs: 100,
        }),
      );

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      const totalLine = calls.find((c) => c.includes('Total:'));
      expect(totalLine).toContain('1 errors');
      expect(totalLine).toContain('2 warnings');
      expect(totalLine).toContain('3 packages');
    });
  });

  describe('--rule 필터', () => {
    it('--rule 필터가 주어지면 매칭되는 규칙만 전달한다', async () => {
      const configWithRules: WrittenConfig = {
        plugins: [],
        rules: {
          'test/specific': 'error',
          'test/other': 'warn',
          'architecture/layers': 'error',
        },
      };
      mockLoadConfigFile.mockResolvedValue(configWithRules);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/specific'],
      });

      const resolveConfig = (await import('@retemper/lodestar')).resolveConfig as ReturnType<
        typeof vi.fn
      >;
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(blocks[0].rules).toStrictEqual({ 'test/specific': 'error' });
    });

    it('--rule에 와일드카드 패턴을 사용할 수 있다', async () => {
      const configWithRules: WrittenConfig = {
        plugins: [],
        rules: {
          'architecture/layers': 'error',
          'architecture/boundaries': 'warn',
          'naming/file': 'error',
        },
      };
      mockLoadConfigFile.mockResolvedValue(configWithRules);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        rule: ['architecture/*'],
      });

      const resolveConfig = (await import('@retemper/lodestar')).resolveConfig as ReturnType<
        typeof vi.fn
      >;
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(Object.keys(blocks[0].rules ?? {})).toStrictEqual([
        'architecture/layers',
        'architecture/boundaries',
      ]);
    });

    it('block에 rules가 없으면 그대로 반환한다', async () => {
      const configWithoutRules: WrittenConfig = { plugins: [] };
      mockLoadConfigFile.mockResolvedValue(configWithoutRules);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/specific'],
      });

      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('json format을 지정하면 JSON reporter를 사용한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'json',
        rule: ['test/*'],
      });

      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('--fix 옵션을 run에 전달한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        fix: true,
      });

      expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ fix: true }));
    });
  });

  describe('--clearCache', () => {
    it('캐시를 클리어하고 메시지를 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        clearCache: true,
      });

      const cacheProvider = vi.mocked(createDiskCacheProvider).mock.results[0].value as {
        clear: ReturnType<typeof vi.fn>;
      };
      expect(cacheProvider.clear).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Cache cleared.');
    });

    it('--cache=false이면 clearCache가 실행되지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        clearCache: true,
        cache: false,
      });

      expect(vi.mocked(createDiskCacheProvider)).not.toHaveBeenCalled();
    });
  });

  describe('--changed 증분 분석', () => {
    it('변경된 파일이 없으면 메시지를 출력하고 반환한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockGetChangedFiles.mockResolvedValue([]);

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        changed: true,
      });

      expect(console.error).toHaveBeenCalledWith('No changed files detected.');
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('변경된 파일이 있으면 영향 범위를 계산하고 run을 호출한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockGetChangedFiles.mockResolvedValue(['src/a.ts', 'src/b.ts']);
      mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts', 'src/b.ts', 'src/c.ts']));
      mockCreateProviders.mockReturnValue({
        graph: {
          getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
        },
      } as never);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        changed: true,
      });

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: expect.any(Set),
        }),
      );
    });

    it('--changed에 문자열을 전달하면 base로 사용한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockGetChangedFiles.mockResolvedValue(['src/a.ts']);
      mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts']));
      mockCreateProviders.mockReturnValue({
        graph: {
          getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
        },
      } as never);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        changed: 'main',
      });

      expect(mockGetChangedFiles).toHaveBeenCalledWith(expect.any(String), 'main');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('vs main'));
    });

    it('증분 분석에서 에러가 있으면 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockGetChangedFiles.mockResolvedValue(['src/a.ts']);
      mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts']));
      mockCreateProviders.mockReturnValue({
        graph: {
          getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
        },
      } as never);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 3 }));

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        changed: true,
      });

      expect(process.exitCode).toBe(1);
    });

    it('증분 분석에서 에러가 없으면 exitCode를 설정하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockGetChangedFiles.mockResolvedValue(['src/a.ts']);
      mockComputeImpactScope.mockReturnValue(new Set(['src/a.ts']));
      mockCreateProviders.mockReturnValue({
        graph: {
          getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
        },
      } as never);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 0 }));

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        changed: true,
      });

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('--adapter 필터', () => {
    it('--adapter 필터가 주어지면 매칭되는 adapter만 전달한다', async () => {
      const configWithAdapters: WrittenConfig = {
        plugins: [],
        adapters: [
          { name: 'eslint', config: {} },
          { name: 'prettier', config: {} },
          { name: 'husky', config: {} },
        ],
      };
      mockLoadConfigFile.mockResolvedValue(configWithAdapters);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        adapter: ['prettier'],
      });

      const resolveConfig = (await import('@retemper/lodestar')).resolveConfig as ReturnType<
        typeof vi.fn
      >;
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(blocks[0].adapters).toHaveLength(1);
      expect(blocks[0].adapters![0].name).toBe('prettier');
    });

    it('--adapter와 --rule을 함께 사용할 수 있다', async () => {
      const config: WrittenConfig = {
        plugins: [],
        rules: { 'test/one': 'error', 'test/two': 'warn' },
        adapters: [
          { name: 'eslint', config: {} },
          { name: 'prettier', config: {} },
        ],
      };
      mockLoadConfigFile.mockResolvedValue(config);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/one'],
        adapter: ['prettier'],
      });

      const resolveConfig = (await import('@retemper/lodestar')).resolveConfig as ReturnType<
        typeof vi.fn
      >;
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(blocks[0].rules).toStrictEqual({ 'test/one': 'error' });
      expect(blocks[0].adapters).toHaveLength(1);
      expect(blocks[0].adapters![0].name).toBe('prettier');
    });
  });

  describe('workspace configTransform', () => {
    it('--adapter와 --rule이 있으면 configTransform을 runWorkspace에 전달한다', async () => {
      const configWithAdapters: WrittenConfig = {
        plugins: [],
        adapters: [
          { name: 'eslint', config: {} },
          { name: 'prettier', config: {} },
        ],
        rules: { 'structure/no-loose-files': 'error', 'conventions/no-korean-comments': 'error' },
      };
      mockLoadConfigFile.mockResolvedValue(configWithAdapters);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
        adapter: ['prettier'],
        rule: ['structure/*'],
      });

      const callArgs = mockRunWorkspace.mock.calls[0][0];
      expect(callArgs.configTransform).toBeDefined();

      // Verify the transform filters correctly
      const transformed = callArgs.configTransform!(configWithAdapters);
      const blocks = Array.isArray(transformed) ? transformed : [transformed];
      expect(blocks[0].adapters).toHaveLength(1);
      expect(blocks[0].adapters![0].name).toBe('prettier');
      expect(blocks[0].rules).toStrictEqual({ 'structure/no-loose-files': 'error' });
    });

    it('--adapter도 --rule도 없으면 configTransform을 전달하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
      });

      const callArgs = mockRunWorkspace.mock.calls[0][0];
      expect(callArgs.configTransform).toBeUndefined();
    });
  });

  describe('reporter 선택', () => {
    it('sarif format을 지정하면 SARIF reporter를 사용한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'sarif',
      });

      expect(createSarifReporter).toHaveBeenCalled();
    });

    it('junit format을 지정하면 JUnit reporter를 사용한다', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'junit',
      });

      expect(createJunitReporter).toHaveBeenCalled();
    });

    it('config에 reporters가 있으면 compositeReporter를 생성한다', async () => {
      const mockResolveConfig = vi.mocked((await import('@retemper/lodestar')).resolveConfig);
      mockResolveConfig.mockReturnValueOnce({
        rootDir: '/fake',
        plugins: [],
        rules: new Map(),
        scopedRules: [],
        baseline: null,
        adapters: [],
        reporters: [
          { name: 'custom', onStart: vi.fn(), onComplete: vi.fn(), onViolation: vi.fn() },
        ],
      } as never);

      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({
        _: ['check'],
        $0: 'lodestar',
        format: 'console',
      });

      expect(createCompositeReporter).toHaveBeenCalled();
    });
  });
});
