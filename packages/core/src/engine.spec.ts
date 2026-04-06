import { describe, it, expect, vi } from 'vitest';
import { run, createProviders } from './engine';
import type { ResolvedConfig, Plugin, RuleDefinition, ToolAdapter, Violation } from '@lodestar/types';

/** 테스트용 최소 ResolvedConfig 생성 */
function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    rootDir: '/test',
    plugins: [],
    rules: new Map(),
    scopedRules: [],
    baseline: null,
    adapters: [],
    ...overrides,
  };
}

/** 주어진 규칙으로 플러그인 생성 */
function makePlugin(name: string, rules: readonly RuleDefinition[]): Plugin {
  return { name, rules };
}

/** 통과하는 규칙 생성 */
function makeRule(name: string): RuleDefinition {
  return {
    name,
    description: `Rule ${name}`,
    needs: [],
    async check() {},
  };
}

/** 위반을 보고하는 규칙 생성 */
function makeFailingRule(name: string, message: string): RuleDefinition {
  return {
    name,
    description: `Rule ${name}`,
    needs: [],
    async check(ctx) {
      ctx.report({ message });
    },
  };
}

describe('createProviders', () => {
  it('4개의 provider를 모두 생성한다', () => {
    const providers = createProviders('/test');

    expect(providers).toHaveProperty('fs');
    expect(providers).toHaveProperty('graph');
    expect(providers).toHaveProperty('ast');
    expect(providers).toHaveProperty('config');
    expect(typeof providers.fs.glob).toBe('function');
    expect(typeof providers.graph.getDependencies).toBe('function');
    expect(typeof providers.ast.getImports).toBe('function');
    expect(typeof providers.config.getPackageJson).toBe('function');
  });
});

describe('run', () => {
  it('알 수 없는 규칙이 있으면 config 유효성 검사에서 에러를 던진다', async () => {
    const rule = makeRule('known/rule');
    const plugin = makePlugin('known', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'known', plugin, options: {} }],
      rules: new Map([
        [
          'unknown/rule',
          { ruleId: 'unknown/rule', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    await expect(run({ config })).rejects.toThrow('Config validation failed');
  });

  it('규칙이 없으면 빈 summary를 반환한다', async () => {
    const config = makeConfig();

    const summary = await run({ config });

    expect(summary.totalRules).toBe(0);
    expect(summary.violations).toStrictEqual([]);
    expect(summary.ruleResults).toStrictEqual([]);
    expect(summary.errorCount).toBe(0);
    expect(summary.warnCount).toBe(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('ruleResults를 포함하는 run summary를 반환한다', async () => {
    const rule = makeFailingRule('test/fail', 'Something wrong');
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/fail',
          { ruleId: 'test/fail', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
    expect(summary.ruleResults).toHaveLength(1);
    expect(summary.ruleResults[0].ruleId).toBe('test/fail');
    expect(summary.ruleResults[0].violations).toHaveLength(1);
    expect(summary.ruleResults[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.warnCount).toBe(0);
  });

  it('severity가 off인 규칙은 실행하지 않는다', async () => {
    const rule = makeFailingRule('test/skip', 'Should not appear');
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/skip',
          { ruleId: 'test/skip', severity: 'off', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    const summary = await run({ config });

    expect(summary.totalRules).toBe(0);
    expect(summary.violations).toStrictEqual([]);
  });

  it('warn severity의 violation을 warnCount에 포함한다', async () => {
    const rule = makeFailingRule('test/warn-rule', 'A warning');
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/warn-rule',
          { ruleId: 'test/warn-rule', severity: 'warn', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    const summary = await run({ config });

    expect(summary.warnCount).toBe(1);
    expect(summary.errorCount).toBe(0);
  });

  it('verifySetup이 실패하면 해당 adapter의 check를 스킵한다', async () => {
    const checkFn = vi.fn().mockResolvedValue([]);
    const adapter: ToolAdapter = {
      name: 'test-tool',
      config: {},
      verifySetup: async () => [
        {
          ruleId: 'test-tool/setup',
          message: 'Config missing',
          severity: 'error',
          fix: { description: 'Create config', apply: vi.fn() },
        },
      ],
      check: checkFn,
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(checkFn).not.toHaveBeenCalled();
    expect(summary.errorCount).toBe(1);
    expect(summary.violations[0].ruleId).toBe('test-tool/setup');
  });

  it('verifySetup 실패 + --fix면 fix 적용 후 check를 실행한다', async () => {
    const fixApply = vi.fn();
    const adapter: ToolAdapter = {
      name: 'test-tool',
      config: {},
      verifySetup: async () => [
        {
          ruleId: 'test-tool/setup',
          message: 'Config missing',
          severity: 'error',
          fix: { description: 'Create config', apply: fixApply },
        },
      ],
      check: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config, fix: true });

    expect(fixApply).toHaveBeenCalledOnce();
    // check가 실행되었으므로 adapter가 totalRules에 포함
    expect(summary.totalRules).toBeGreaterThanOrEqual(1);
  });

  it('verifySetup이 통과하면 check를 정상 실행한다', async () => {
    const checkFn = vi.fn().mockResolvedValue([
      { ruleId: 'test-tool/some-rule', message: 'lint error', severity: 'error' as const },
    ]);
    const adapter: ToolAdapter = {
      name: 'test-tool',
      config: {},
      verifySetup: async () => [],
      check: checkFn,
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(checkFn).toHaveBeenCalledOnce();
    expect(summary.errorCount).toBe(1);
    expect(summary.violations[0].ruleId).toBe('test-tool/some-rule');
  });

  it('reporter의 onRuleStart와 onRuleComplete 콜백을 호출한다', async () => {
    const rule = makeRule('test/rule');
    const plugin = makePlugin('test', [rule]);

    const calls: string[] = [];
    const reporter = {
      name: 'test',
      onStart: () => calls.push('start'),
      onRuleStart: (ruleId: string) => calls.push(`ruleStart:${ruleId}`),
      onRuleComplete: () => calls.push('ruleComplete'),
      onViolation: () => calls.push('violation'),
      onComplete: () => calls.push('complete'),
    };

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/rule',
          { ruleId: 'test/rule', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    await run({ config, reporter });

    expect(calls).toContain('start');
    expect(calls).toContain('ruleStart:test/rule');
    expect(calls).toContain('ruleComplete');
    expect(calls).toContain('complete');
  });
});
