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

  describe('설정 파일이 없는 경우', () => {
    it('에러 메시지를 출력하고 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await watchCommand({ _: ['watch'], $0: 'lodestar', format: 'console' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No lodestar.config.ts found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('createWatcher를 호출하지 않는다', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await watchCommand({ _: ['watch'], $0: 'lodestar', format: 'console' });

      expect(mockCreateWatcher).not.toHaveBeenCalled();
    });
  });

  describe('설정 파일이 있는 경우', () => {
    const stubConfig: WrittenConfig = { plugins: [], rules: {} };

    beforeEach(() => {
      mockLoadConfigFile.mockResolvedValue(stubConfig);
      // Bypass the forever-pending Promise in createWatcher by returning immediately
      mockCreateWatcher.mockImplementation((() => {
        return mockWatcherHandle;
      }) as never);
    });

    it('createWatcher를 호출한다', async () => {
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

    it('--fix 옵션을 createWatcher에 전달한다', async () => {
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

    it('--cache=false이면 캐시 프로바이더를 전달하지 않는다', async () => {
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

    it('--debounce 옵션을 createWatcher에 전달한다', async () => {
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

    it('json format을 지정하면 JSON reporter를 사용한다', async () => {
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

    it('SIGINT와 SIGTERM 핸들러를 등록한다', async () => {
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

    it('SIGINT 핸들러가 watcher를 정리하고 process.exit을 호출한다', async () => {
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

    it('onCycle 콜백이 요약 정보를 로그에 출력한다', async () => {
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

    it('onCycle에서 변경된 파일이 5개 이하이면 파일 목록을 출력한다', async () => {
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

    it('onCycle에서 변경된 파일이 5개 초과이면 파일 목록을 출력하지 않는다', async () => {
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

  describe('--rule 필터', () => {
    it('--rule 필터가 주어지면 매칭되는 규칙만 전달한다', async () => {
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

    it('어떤 패턴에도 매칭되지 않으면 false를 반환한다', async () => {
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

    it('block에 rules가 없으면 그대로 반환한다', async () => {
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

    it('배열 형태의 config에서 규칙을 필터링한다', async () => {
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
