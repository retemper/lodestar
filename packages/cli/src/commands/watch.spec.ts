import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WrittenConfig } from '@retemper/lodestar';

/** Creates a test logger that delegates to console.error (spied in beforeEach) */
function createMockLogger() {
  return {
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  };
}

const mockWatcherHandle = { close: vi.fn() };

vi.mock('@retemper/lodestar', () => ({
  loadConfigFile: vi.fn(),
  resolveConfig: vi.fn(() => ({
    rootDir: '/fake',
    plugins: [],
    rules: new Map(),
    scopedRules: [],
    baseline: null,
    adapters: [],
    reporters: [],
  })),
  createDiskCacheProvider: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
  createLogger: vi.fn(() => createMockLogger()),
  createWatcher: vi.fn(() => mockWatcherHandle),
  createCompositeReporter: vi.fn((reporters: readonly unknown[]) => reporters[0]),
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

import { watchCommand } from './watch';
import { loadConfigFile, createWatcher, createCompositeReporter } from '@retemper/lodestar';
import { createJsonReporter } from '../reporters/json';

const mockLoadConfigFile = vi.mocked(loadConfigFile);
const mockCreateWatcher = vi.mocked(createWatcher);

describe('watchCommand', () => {
  /** Track registered process.on signal handlers */
  const registeredHandlers: Array<{ event: string; handler: () => void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      registeredHandlers.push({ event, handler });
      return process;
    }) as never);
    process.exitCode = undefined;
    registeredHandlers.length = 0;
    mockLoadConfigFile.mockResolvedValue(null);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('when config file is missing', () => {
    it('outputs error message and sets exitCode to 1', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await watchCommand({ _: ['watch'], $0: 'lodestar', format: 'console' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No lodestar.config.ts found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('does not call createWatcher', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await watchCommand({ _: ['watch'], $0: 'lodestar', format: 'console' });

      expect(mockCreateWatcher).not.toHaveBeenCalled();
    });
  });

  describe('when config file exists', () => {
    const stubConfig: WrittenConfig = { plugins: [], rules: {} };

    beforeEach(() => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      // Bypass the forever-pending Promise in createWatcher by returning immediately
      mockCreateWatcher.mockImplementation((() => {
        return mockWatcherHandle;
      }) as never);
    });

    it('calls createWatcher', async () => {
      // watchCommand awaits a forever-pending Promise, so verify internal logic via mocks
      const promise = watchCommand({ _: ['watch'], $0: 'lodestar', format: 'console' });

      // Wait for async setup to complete before asserting
      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      // Verify options passed to createWatcher
      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(callArgs).toHaveProperty('config');
      expect(callArgs).toHaveProperty('reporter');
      expect(callArgs).toHaveProperty('logger');

      // Consume the promise to prevent test hanging
      void promise;
    });

    it('passes --fix option to createWatcher', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        fix: true,
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(callArgs.fix).toBe(true);

      void promise;
    });

    it('does not pass cache provider when --cache=false', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        cache: false,
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(callArgs.cache).toBeUndefined();

      void promise;
    });

    it('passes --debounce option to createWatcher', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        debounce: 500,
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(callArgs.debounceMs).toBe(500);

      void promise;
    });

    it('uses JSON reporter when json format is specified', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'json',
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      expect(createJsonReporter).toHaveBeenCalled();

      void promise;
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

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      expect(createCompositeReporter).toHaveBeenCalled();

      void promise;
    });

    it('registers SIGINT and SIGTERM handlers', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(registeredHandlers.length).toBeGreaterThanOrEqual(2);
      });

      const events = registeredHandlers.map((h) => h.event);
      expect(events).toContain('SIGINT');
      expect(events).toContain('SIGTERM');

      void promise;
    });

    it('SIGINT handler cleans up watcher and calls process.exit', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(registeredHandlers.length).toBeGreaterThanOrEqual(2);
      });

      const sigintHandler = registeredHandlers.find((h) => h.event === 'SIGINT');
      sigintHandler!.handler();

      expect(mockWatcherHandle.close).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
      void promise;
    });

    it('onCycle callback outputs summary info to log', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      const onCycle = callArgs.onCycle as (summary: Record<string, unknown>) => void;

      onCycle({
        changedFiles: ['src/a.ts', 'src/b.ts'],
        scopeSize: 10,
        errorCount: 1,
        warnCount: 2,
        durationMs: 42.5,
      });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('2 changed'));

      void promise;
    });

    it('outputs file list when changed files are 5 or fewer in onCycle', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      const onCycle = callArgs.onCycle as (summary: Record<string, unknown>) => void;

      onCycle({
        changedFiles: ['src/a.ts'],
        scopeSize: 5,
        errorCount: 0,
        warnCount: 0,
        durationMs: 10,
      });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Files: src/a.ts'));

      void promise;
    });

    it('does not output file list when changed files exceed 5 in onCycle', async () => {
      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockCreateWatcher.mock.calls[0][0] as unknown as Record<string, unknown>;
      const onCycle = callArgs.onCycle as (summary: Record<string, unknown>) => void;

      // Clear previous calls
      (console.error as ReturnType<typeof vi.fn>).mockClear();

      onCycle({
        changedFiles: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'],
        scopeSize: 20,
        errorCount: 0,
        warnCount: 0,
        durationMs: 10,
      });

      const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0] as string,
      );
      expect(calls.some((c) => c.includes('Files:'))).toBe(false);

      void promise;
    });
  });

  describe('--rule filter', () => {
    it('passes only matching rules when --rule filter is given', async () => {
      const configWithRules: WrittenConfig = {
        plugins: [],
        rules: {
          'test/specific': 'error',
          'test/other': 'warn',
        },
      };
      mockLoadConfigFile.mockResolvedValue(configWithRules);

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/specific'],
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const resolveConfig = vi.mocked((await import('@retemper/lodestar')).resolveConfig);
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(blocks[0].rules).toStrictEqual({ 'test/specific': 'error' });

      void promise;
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

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        rule: ['architecture/*'],
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const resolveConfig = vi.mocked((await import('@retemper/lodestar')).resolveConfig);
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(Object.keys(blocks[0].rules ?? {})).toStrictEqual([
        'architecture/layers',
        'architecture/boundaries',
      ]);

      void promise;
    });

    it('returns false when no pattern matches', async () => {
      const configWithRules: WrittenConfig = {
        plugins: [],
        rules: {
          'test/rule': 'error',
        },
      };
      mockLoadConfigFile.mockResolvedValue(configWithRules);

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        rule: ['other/rule'],
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const resolveConfig = vi.mocked((await import('@retemper/lodestar')).resolveConfig);
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(Object.keys(blocks[0].rules ?? {})).toStrictEqual([]);

      void promise;
    });

    it('returns block as-is when it has no rules', async () => {
      const configWithoutRules: WrittenConfig = { plugins: [] };
      mockLoadConfigFile.mockResolvedValue(configWithoutRules);

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/specific'],
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      void promise;
    });

    it('filters rules in array-style config', async () => {
      const arrayConfig: WrittenConfig = [
        { plugins: [], rules: { 'test/a': 'error' } },
        { plugins: [], rules: { 'test/b': 'warn', 'other/c': 'error' } },
      ];
      mockLoadConfigFile.mockResolvedValue(arrayConfig);

      const promise = watchCommand({
        _: ['watch'],
        $0: 'lodestar',
        format: 'console',
        rule: ['test/*'],
      });

      await vi.waitFor(() => {
        expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      });

      const resolveConfig = vi.mocked((await import('@retemper/lodestar')).resolveConfig);
      const passedConfig = resolveConfig.mock.calls[0][0] as WrittenConfig;
      const blocks = Array.isArray(passedConfig) ? passedConfig : [passedConfig];
      expect(blocks[0].rules).toStrictEqual({ 'test/a': 'error' });
      expect(blocks[1].rules).toStrictEqual({ 'test/b': 'warn' });

      void promise;
    });
  });
});
