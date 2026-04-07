import { describe, expect, it, vi } from 'vitest';
import { run, createProviders } from './engine';
import type { ResolvedConfig, Plugin, RuleDefinition, ToolAdapter } from '@retemper/types';

/** Creates a minimal ResolvedConfig for testing */
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

/** Creates a plugin with the given rules */
function makePlugin(name: string, rules: readonly RuleDefinition[]): Plugin {
  return { name, rules };
}

/** Creates a passing rule */
function makeRule(name: string): RuleDefinition {
  return {
    name,
    description: `Rule ${name}`,
    needs: [],
    async check() {},
  };
}

/** Creates a rule that reports a violation */
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
    // check was executed, so the adapter is included in totalRules
    expect(summary.totalRules).toBeGreaterThanOrEqual(1);
  });

  it('verifySetup이 통과하면 check를 정상 실행한다', async () => {
    const checkFn = vi
      .fn()
      .mockResolvedValue([
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

  it('fix 모드에서 adapter violation에 fix가 있으면 apply를 호출한다', async () => {
    const adapterFixApply = vi.fn();
    const adapter: ToolAdapter = {
      name: 'lint-tool',
      config: {},
      check: async () => [
        {
          ruleId: 'lint-tool/rule',
          message: 'Lint error',
          severity: 'error' as const,
          fix: { description: 'Auto-fix', apply: adapterFixApply },
        },
      ],
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, fix: true });

    expect(adapterFixApply).toHaveBeenCalledOnce();
  });

  it('adapter.fix가 있으면 fix 모드에서 호출한다', async () => {
    const adapterFix = vi.fn();
    const adapter: ToolAdapter = {
      name: 'format-tool',
      config: {},
      check: async () => [],
      fix: adapterFix,
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, fix: true });

    expect(adapterFix).toHaveBeenCalledOnce();
    expect(adapterFix).toHaveBeenCalledWith('/test', ['**/*.ts', '**/*.tsx']);
  });

  it('scopedRules의 규칙 수를 totalRuleCount에 포함한다', async () => {
    const rule = makeFailingRule('test/scoped', 'Scoped issue');
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map(),
      scopedRules: [
        {
          files: ['src/**/*.ts'],
          ignores: [],
          rules: new Map([
            [
              'test/scoped',
              {
                ruleId: 'test/scoped',
                severity: 'error',
                options: {},
              },
            ],
          ]),
        },
      ],
    });

    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
    expect(summary.violations).toHaveLength(1);
    expect(summary.violations[0].ruleId).toBe('test/scoped');
  });

  it('verifySetup이 에러를 throw하면 해당 adapter를 스킵하고 에러를 기록한다', async () => {
    const checkFn = vi.fn().mockResolvedValue([]);
    const adapter: ToolAdapter = {
      name: 'broken-setup',
      config: {},
      verifySetup: async () => {
        throw new Error('Setup crashed');
      },
      check: checkFn,
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(checkFn).not.toHaveBeenCalled();
    expect(summary.totalRules).toBeGreaterThanOrEqual(1);
  });

  it('adapter.check가 에러를 throw하면 에러를 기록한다', async () => {
    const adapter: ToolAdapter = {
      name: 'error-adapter',
      config: {},
      check: async () => {
        throw new Error('Check crashed');
      },
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(summary.violations).toStrictEqual([]);
  });

  it('fix 모드에서 네이티브 규칙 violation에 fix가 있으면 apply를 호출한다', async () => {
    const fixApply = vi.fn();
    const rule: RuleDefinition = {
      name: 'test/fixable',
      description: 'Fixable rule',
      needs: [],
      async check(ctx) {
        ctx.report({
          message: 'Fixable issue',
          fix: { description: 'Auto-fix it', apply: fixApply },
        });
      },
    };
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/fixable',
          { ruleId: 'test/fixable', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    await run({ config, fix: true });

    expect(fixApply).toHaveBeenCalledOnce();
  });

  it('fix 모드에서 setup violation에 fix가 없으면 skip한다', async () => {
    const adapter: ToolAdapter = {
      name: 'no-fix-setup',
      config: {},
      verifySetup: async () => [
        {
          ruleId: 'no-fix-setup/setup',
          message: 'Config missing',
          severity: 'error' as const,
        },
      ],
      check: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config, fix: true });

    expect(summary.violations).toHaveLength(1);
  });

  it('fix 모드에서 네이티브 violation에 fix가 없으면 skip한다', async () => {
    const rule = makeFailingRule('test/no-fix', 'No fix available');
    const plugin = makePlugin('test', [rule]);

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/no-fix',
          { ruleId: 'test/no-fix', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
    });

    const summary = await run({ config, fix: true });

    expect(summary.violations).toHaveLength(1);
  });

  it('fix 모드에서 adapter violation에 fix가 없으면 skip한다', async () => {
    const adapter: ToolAdapter = {
      name: 'no-fix-adapter',
      config: {},
      check: async () => [
        {
          ruleId: 'no-fix-adapter/rule',
          message: 'No fix',
          severity: 'error' as const,
        },
      ],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config, fix: true });

    expect(summary.violations).toHaveLength(1);
  });

  it('verifySetup이 비-Error 객체를 throw하면 Error로 래핑하고 reporter에 전달한다', async () => {
    const completeCalls: Array<{ ruleId: string; error?: Error }> = [];
    const reporter = {
      name: 'test',
      onStart: vi.fn(),
      onRuleStart: vi.fn(),
      onRuleComplete: (info: { ruleId: string; error?: Error }) => completeCalls.push(info),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };

    const adapter: ToolAdapter = {
      name: 'string-error-setup',
      config: {},
      verifySetup: async () => {
        throw 'string error';
      },
      check: vi.fn().mockResolvedValue([]),
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, reporter });

    const errorCall = completeCalls.find((c) => c.ruleId === 'string-error-setup/setup');
    expect(errorCall?.error?.message).toBe('string error');
  });

  it('adapter.check가 비-Error 객체를 throw하면 Error로 래핑하고 reporter에 전달한다', async () => {
    const completeCalls: Array<{ ruleId: string; error?: Error }> = [];
    const reporter = {
      name: 'test',
      onStart: vi.fn(),
      onRuleStart: vi.fn(),
      onRuleComplete: (info: { ruleId: string; error?: Error }) => completeCalls.push(info),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };

    const adapter: ToolAdapter = {
      name: 'string-error-check',
      config: {},
      check: async () => {
        throw 'string check error';
      },
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, reporter });

    const errorCall = completeCalls.find((c) => c.ruleId === 'string-error-check');
    expect(errorCall?.error?.message).toBe('string check error');
  });

  it('check가 없는 adapter는 스킵한다', async () => {
    const adapter: ToolAdapter = {
      name: 'no-check',
      config: {},
      verifySetup: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
  });

  it('verifySetup이 없는 adapter도 정상 처리한다', async () => {
    const adapter: ToolAdapter = {
      name: 'no-setup',
      config: {},
      check: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
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

  it('adapter.check 에러 시 reporter가 있으면 onRuleComplete에 에러를 전달한다', async () => {
    const completeCalls: Array<{ ruleId: string; error?: Error }> = [];
    const reporter = {
      name: 'test',
      onStart: vi.fn(),
      onRuleStart: vi.fn(),
      onRuleComplete: (info: { ruleId: string; error?: Error }) => completeCalls.push(info),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };

    const adapter: ToolAdapter = {
      name: 'crash-adapter',
      config: {},
      check: async () => {
        throw new Error('Check exploded');
      },
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, reporter });

    const errorCall = completeCalls.find((c) => c.ruleId === 'crash-adapter');
    expect(errorCall?.error?.message).toBe('Check exploded');
  });

  it('verifySetup 에러 시 reporter가 있으면 onRuleComplete에 에러를 전달한다', async () => {
    const completeCalls: Array<{ ruleId: string; error?: Error }> = [];
    const reporter = {
      name: 'test',
      onStart: vi.fn(),
      onRuleStart: vi.fn(),
      onRuleComplete: (info: { ruleId: string; error?: Error }) => completeCalls.push(info),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };

    const adapter: ToolAdapter = {
      name: 'setup-crash',
      config: {},
      verifySetup: async () => {
        throw new Error('Setup exploded');
      },
      check: vi.fn(),
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, reporter });

    const errorCall = completeCalls.find((c) => c.ruleId === 'setup-crash/setup');
    expect(errorCall?.error?.message).toBe('Setup exploded');
  });

  it('reporter와 adapter를 함께 사용하면 모든 lifecycle 콜백을 호출한다', async () => {
    const calls: string[] = [];
    const reporter = {
      name: 'full',
      onStart: () => calls.push('start'),
      onRuleStart: (ruleId: string) => calls.push(`ruleStart:${ruleId}`),
      onRuleComplete: () => calls.push('ruleComplete'),
      onViolation: () => calls.push('violation'),
      onComplete: () => calls.push('complete'),
    };

    const adapter: ToolAdapter = {
      name: 'lint',
      config: {},
      verifySetup: async () => [],
      check: async () => [{ ruleId: 'lint/rule', message: 'issue', severity: 'warn' as const }],
    };

    const config = makeConfig({ adapters: [adapter] });
    await run({ config, reporter });

    expect(calls).toContain('ruleStart:lint/setup');
    expect(calls).toContain('ruleStart:lint');
    expect(calls).toContain('violation');
    expect(calls).toContain('complete');
  });

  it('config.rules가 있을 때 adapter.check에 include 패턴을 전달한다', async () => {
    const checkFn = vi.fn().mockResolvedValue([]);
    const rule = makeRule('test/rule');
    const plugin = makePlugin('test', [rule]);
    const adapter: ToolAdapter = {
      name: 'check-include',
      config: {},
      check: checkFn,
    };

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      rules: new Map([
        [
          'test/rule',
          { ruleId: 'test/rule', severity: 'error', options: {}, include: [], exclude: [] },
        ],
      ]),
      adapters: [adapter],
    });

    await run({ config });

    expect(checkFn).toHaveBeenCalledWith('/test', ['**/*.ts', '**/*.tsx']);
  });

  it('scopedRules에 reporter 콜백을 호출한다', async () => {
    const rule = makeRule('test/scoped-reporter');
    const plugin = makePlugin('test', [rule]);
    const calls: string[] = [];
    const reporter = {
      name: 'scoped',
      onStart: vi.fn(),
      onRuleStart: (ruleId: string) => calls.push(`ruleStart:${ruleId}`),
      onRuleComplete: () => calls.push('ruleComplete'),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };

    const config = makeConfig({
      plugins: [{ name: 'test', plugin, options: {} }],
      scopedRules: [
        {
          files: ['src/**/*.ts'],
          ignores: [],
          rules: new Map([
            [
              'test/scoped-reporter',
              {
                ruleId: 'test/scoped-reporter',
                severity: 'error',
                options: {},
              },
            ],
          ]),
        },
      ],
    });

    await run({ config, reporter });

    expect(calls).toContain('ruleStart:test/scoped-reporter');
    expect(calls).toContain('ruleComplete');
  });
});
