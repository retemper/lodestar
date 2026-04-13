import { describe, expect, it, vi } from 'vitest';
import { run, createProviders } from './engine';
import type { ResolvedConfig, Plugin, RuleDefinition, ToolAdapter } from '@retemper/lodestar-types';

/** Creates a minimal ResolvedConfig for testing */
function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    rootDir: '/test',
    plugins: [],
    rules: new Map(),
    scopedRules: [],
    baseline: null,
    reporters: [],
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
  it('creates all 4 providers', () => {
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
  it('throws error in config validation when unknown rules exist', async () => {
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

  it('returns empty summary when there are no rules', async () => {
    const config = makeConfig();

    const summary = await run({ config });

    expect(summary.totalRules).toBe(0);
    expect(summary.violations).toStrictEqual([]);
    expect(summary.ruleResults).toStrictEqual([]);
    expect(summary.errorCount).toBe(0);
    expect(summary.warnCount).toBe(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns run summary containing ruleResults', async () => {
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

  it('does not run rules with off severity', async () => {
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

  it('includes warn severity violations in warnCount', async () => {
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

  it('skips adapter check when verifySetup fails', async () => {
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

  it('applies fix then runs check when verifySetup fails with --fix', async () => {
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

  it('runs check normally when verifySetup passes', async () => {
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

  it('calls apply when adapter violation has fix in fix mode', async () => {
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

  it('calls adapter.fix in fix mode when it exists', async () => {
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

  it('includes scopedRules rule count in totalRuleCount', async () => {
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

  it('skips adapter and logs error when verifySetup throws', async () => {
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

  it('logs error when adapter.check throws', async () => {
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

  it('calls apply when native rule violation has fix in fix mode', async () => {
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

  it('skips when setup violation has no fix in fix mode', async () => {
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

  it('skips when native violation has no fix in fix mode', async () => {
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

  it('skips when adapter violation has no fix in fix mode', async () => {
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

  it('wraps non-Error object in Error and passes to reporter when verifySetup throws', async () => {
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

  it('wraps non-Error object in Error and passes to reporter when adapter.check throws', async () => {
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

  it('skips adapters without check', async () => {
    const adapter: ToolAdapter = {
      name: 'no-check',
      config: {},
      verifySetup: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
  });

  it('handles adapters without verifySetup normally', async () => {
    const adapter: ToolAdapter = {
      name: 'no-setup',
      config: {},
      check: async () => [],
    };

    const config = makeConfig({ adapters: [adapter] });
    const summary = await run({ config });

    expect(summary.totalRules).toBe(1);
  });

  it('calls reporter onRuleStart and onRuleComplete callbacks', async () => {
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

  it('passes error to onRuleComplete via reporter when adapter.check throws', async () => {
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

  it('passes error to onRuleComplete via reporter when verifySetup throws', async () => {
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

  it('calls all lifecycle callbacks when using reporter and adapter together', async () => {
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

  it('passes include patterns to adapter.check when config.rules exists', async () => {
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

  it('calls reporter callbacks for scopedRules', async () => {
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
