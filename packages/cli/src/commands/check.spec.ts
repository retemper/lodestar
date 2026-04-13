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

  describe('when config file is missing', () => {
    it('outputs error message and sets exitCode to 1', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No lodestar.config.ts found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('does not call run or runWorkspace', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockRunWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('single project mode', () => {
    it('calls run when no workspace is detected', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRunWorkspace).not.toHaveBeenCalled();
    });

    it('does not set exitCode when there are no errors', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 0, warnCount: 3 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBeUndefined();
    });

    it('sets exitCode to 1 when there are errors', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRun.mockResolvedValue(makeSummary({ errorCount: 2 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBe(1);
    });
  });

  describe('workspace mode', () => {
    it('calls runWorkspace when workspace is detected', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(mockRunWorkspace).toHaveBeenCalledTimes(1);
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('forces workspace mode when --workspace flag is true', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console', workspace: true });

      expect(mockRunWorkspace).toHaveBeenCalledTimes(1);
      expect(mockDiscoverWorkspaces).not.toHaveBeenCalled();
    });

    it('forces single project mode when --workspace flag is false', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockRun.mockResolvedValue(makeSummary());

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console', workspace: false });

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRunWorkspace).not.toHaveBeenCalled();
      expect(mockDiscoverWorkspaces).not.toHaveBeenCalled();
    });

    it('sets exitCode to 1 when there are errors in workspace mode', async () => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      mockDiscoverWorkspaces.mockResolvedValue([
        { name: '@retemper/lodestar-core', dir: '/fake/packages/core' },
      ]);
      mockRunWorkspace.mockResolvedValue(makeWorkspaceSummary({ totalErrorCount: 5 }));

      await checkCommand({ _: ['check'], $0: 'lodestar', format: 'console' });

      expect(process.exitCode).toBe(1);
    });

    it('does not set exitCode when there are only warnings in workspace mode', async () => {
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

    it('outputs total elapsed time in workspace mode', async () => {
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

    it('outputs total message including package count', async () => {
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

  describe('--rule filter', () => {
    it('passes only matching rules when --rule filter is given', async () => {
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

    it('supports wildcard patterns in --rule', async () => {
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

    it('returns block as-is when it has no rules', async () => {
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

    it('uses JSON reporter when json format is specified', async () => {
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

    it('passes --fix option to run', async () => {
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
    it('clears cache and prints message', async () => {
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

    it('does not run clearCache when --cache=false', async () => {
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

  describe('--changed incremental analysis', () => {
    it('prints message and returns when no files changed', async () => {
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

    it('calculates impact scope and calls run when files changed', async () => {
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

    it('uses the string passed to --changed as base', async () => {
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

    it('sets exitCode to 1 when incremental analysis has errors', async () => {
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

    it('does not set exitCode when incremental analysis has no errors', async () => {
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

  describe('--adapter filter', () => {
    it('passes only matching adapters when --adapter filter is given', async () => {
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

    it('can use --adapter and --rule together', async () => {
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
    it('passes configTransform to runWorkspace when --adapter and --rule are given', async () => {
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

    it('does not pass configTransform when neither --adapter nor --rule is given', async () => {
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

  describe('reporter selection', () => {
    it('uses SARIF reporter when sarif format is specified', async () => {
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

    it('uses JUnit reporter when junit format is specified', async () => {
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

    it('creates compositeReporter when config has reporters', async () => {
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
