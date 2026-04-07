import { describe, it, expect, vi } from 'vitest';
import type { RuleDefinition, RuleProviders, ResolvedRuleConfig } from '@retemper/types';
import { runRule, runRules } from './runner';

/** Creates mock providers for testing */
function createMockProviders(): RuleProviders {
  return {
    fs: {
      glob: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({}),
    },
    graph: {
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
      hasCircular: vi.fn().mockResolvedValue(false),
      getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
    },
    ast: {
      getSourceFile: vi.fn().mockResolvedValue(null),
      getImports: vi.fn().mockResolvedValue([]),
      getExports: vi.fn().mockResolvedValue([]),
    },
    config: {
      getPackageJson: vi.fn().mockResolvedValue({}),
      getTsConfig: vi.fn().mockResolvedValue({}),
      getCustomConfig: vi.fn().mockResolvedValue({}),
    },
  };
}

/** Creates a default rule config for testing */
function createRuleConfig(overrides: Partial<ResolvedRuleConfig> = {}): ResolvedRuleConfig {
  return {
    ruleId: 'test/rule',
    severity: 'error',
    options: {},
    ...overrides,
  };
}

/** A passing rule that reports no violations */
function createPassingRule(name = 'test/passing'): RuleDefinition {
  return {
    name,
    description: 'A rule that always passes',
    needs: [],
    async check() {
      // no violations
    },
  };
}

/** A rule that always reports a violation */
function createFailingRule(name = 'test/failing'): RuleDefinition {
  return {
    name,
    description: 'A rule that always reports a violation',
    needs: [],
    async check(ctx) {
      ctx.report({ message: 'Something is wrong' });
    },
  };
}

/** A rule that throws an error */
function createThrowingRule(error: unknown = new Error('Rule crashed')): RuleDefinition {
  return {
    name: 'test/throwing',
    description: 'A rule that throws',
    needs: [],
    async check() {
      throw error;
    },
  };
}

describe('runRule', () => {
  const providers = createMockProviders();

  describe('normal execution', () => {
    it('returns an empty violations array when there are no violations', async () => {
      const result = await runRule(createPassingRule(), createRuleConfig(), providers, '/root');

      expect(result.ruleId).toBe('test/passing');
      expect(result.violations).toStrictEqual([]);
      expect(result.error).toBeUndefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('includes reported violations in the violations array', async () => {
      const result = await runRule(
        createFailingRule(),
        createRuleConfig({ ruleId: 'test/failing' }),
        providers,
        '/root',
      );

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toStrictEqual({
        ruleId: 'test/failing',
        message: 'Something is wrong',
        location: undefined,
        severity: 'error',
        fix: undefined,
      });
    });

    it('reflects the config severity in violations', async () => {
      const result = await runRule(
        createFailingRule(),
        createRuleConfig({ severity: 'warn' }),
        providers,
        '/root',
      );

      expect(result.violations[0].severity).toBe('warn');
    });

    it('passes config options to the context', async () => {
      const receivedOptions: Record<string, unknown>[] = [];
      const rule: RuleDefinition = {
        name: 'test/options',
        description: 'Captures options',
        needs: [],
        async check(ctx) {
          receivedOptions.push({ ...ctx.options });
        },
      };

      await runRule(
        rule,
        createRuleConfig({ options: { max: 10, strict: true } }),
        providers,
        '/root',
      );

      expect(receivedOptions[0]).toStrictEqual({ max: 10, strict: true });
    });

    it('passes rootDir to the context', async () => {
      const capturedRootDirs: string[] = [];
      const rule: RuleDefinition = {
        name: 'test/root',
        description: 'Captures rootDir',
        needs: [],
        async check(ctx) {
          capturedRootDirs.push(ctx.rootDir);
        },
      };

      await runRule(rule, createRuleConfig(), providers, '/my/project');

      expect(capturedRootDirs[0]).toBe('/my/project');
    });

    it('collects all violations when multiple are reported', async () => {
      const rule: RuleDefinition = {
        name: 'test/multi',
        description: 'Reports multiple violations',
        needs: [],
        async check(ctx) {
          ctx.report({ message: 'First issue' });
          ctx.report({ message: 'Second issue' });
          ctx.report({ message: 'Third issue' });
        },
      };

      const result = await runRule(rule, createRuleConfig(), providers, '/root');

      expect(result.violations).toHaveLength(3);
      expect(result.violations.map((v) => v.message)).toStrictEqual([
        'First issue',
        'Second issue',
        'Third issue',
      ]);
    });

    it('can report a violation with location information', async () => {
      const rule: RuleDefinition = {
        name: 'test/location',
        description: 'Reports with location',
        needs: [],
        async check(ctx) {
          ctx.report({
            message: 'Bad import',
            location: { file: 'src/index.ts', line: 10, column: 5 },
          });
        },
      };

      const result = await runRule(rule, createRuleConfig(), providers, '/root');

      expect(result.violations[0].location).toStrictEqual({
        file: 'src/index.ts',
        line: 10,
        column: 5,
      });
    });

    it('durationMs is greater than or equal to 0', async () => {
      const result = await runRule(createPassingRule(), createRuleConfig(), providers, '/root');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('includes thrown Error in the error field', async () => {
      const result = await runRule(
        createThrowingRule(new Error('Boom')),
        createRuleConfig(),
        providers,
        '/root',
      );

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Boom');
    });

    it('wraps a thrown string into an Error', async () => {
      const result = await runRule(
        createThrowingRule('string error'),
        createRuleConfig(),
        providers,
        '/root',
      );

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('string error');
    });

    it('wraps a thrown number into an Error', async () => {
      const result = await runRule(createThrowingRule(42), createRuleConfig(), providers, '/root');

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('42');
    });

    it('preserves violations reported before the error occurred', async () => {
      const rule: RuleDefinition = {
        name: 'test/partial',
        description: 'Reports then crashes',
        needs: [],
        async check(ctx) {
          ctx.report({ message: 'Found before crash' });
          throw new Error('Crash');
        },
      };

      const result = await runRule(rule, createRuleConfig(), providers, '/root');

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toBe('Found before crash');
      expect(result.error?.message).toBe('Crash');
    });

    it('records durationMs even when an error occurs', async () => {
      const result = await runRule(createThrowingRule(), createRuleConfig(), providers, '/root');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('severity가 off인 경우', () => {
    it('severity가 off이면 report를 호출해도 violations에 추가하지 않는다', async () => {
      const result = await runRule(
        createFailingRule(),
        createRuleConfig({ severity: 'off' }),
        providers,
        '/root',
      );

      expect(result.violations).toStrictEqual([]);
    });
  });

  describe('meta', () => {
    it('ctx.meta를 호출하면 result.meta에 반영된다', async () => {
      const rule: RuleDefinition = {
        name: 'test/meta',
        description: 'Reports meta',
        needs: [],
        async check(ctx) {
          ctx.meta('14 files checked');
        },
      };

      const result = await runRule(rule, createRuleConfig(), providers, '/root');

      expect(result.meta).toBe('14 files checked');
    });

    it('ctx.meta를 호출하지 않으면 result.meta는 undefined이다', async () => {
      const result = await runRule(createPassingRule(), createRuleConfig(), providers, '/root');

      expect(result.meta).toBeUndefined();
    });

    it('에러 발생 시에도 이전에 설정한 meta를 유지한다', async () => {
      const rule: RuleDefinition = {
        name: 'test/meta-error',
        description: 'Sets meta then throws',
        needs: [],
        async check(ctx) {
          ctx.meta('partial progress');
          throw new Error('crash');
        },
      };

      const result = await runRule(rule, createRuleConfig(), providers, '/root');

      expect(result.meta).toBe('partial progress');
      expect(result.error?.message).toBe('crash');
    });
  });

  describe('providers access', () => {
    it('can access providers through the context', async () => {
      const mockProviders = createMockProviders();
      (mockProviders.fs.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const rule: RuleDefinition = {
        name: 'test/providers',
        description: 'Uses fs provider',
        needs: ['fs'],
        async check(ctx) {
          const exists = await ctx.providers.fs.exists('src');
          if (!exists) {
            ctx.report({ message: 'src not found' });
          }
        },
      };

      const result = await runRule(rule, createRuleConfig(), mockProviders, '/root');

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toBe('src not found');
    });
  });
});

describe('runRules', () => {
  const providers = createMockProviders();

  it('returns an empty results array when an empty rules array is passed', async () => {
    const results = await runRules([], providers, '/root');
    expect(results).toStrictEqual([]);
  });

  it('returns results with no violations when all rules pass', async () => {
    const rules = [
      { rule: createPassingRule('rule-a'), config: createRuleConfig({ ruleId: 'rule-a' }) },
      { rule: createPassingRule('rule-b'), config: createRuleConfig({ ruleId: 'rule-b' }) },
    ];

    const results = await runRules(rules, providers, '/root');

    expect(results).toHaveLength(2);
    expect(results[0].violations).toStrictEqual([]);
    expect(results[1].violations).toStrictEqual([]);
  });

  it('correctly collects violations from failed rules', async () => {
    const rules = [
      { rule: createPassingRule('rule-a'), config: createRuleConfig({ ruleId: 'rule-a' }) },
      { rule: createFailingRule('rule-b'), config: createRuleConfig({ ruleId: 'rule-b' }) },
    ];

    const results = await runRules(rules, providers, '/root');

    expect(results[0].violations).toHaveLength(0);
    expect(results[1].violations).toHaveLength(1);
  });

  it('runs other rules normally even when one rule throws an error', async () => {
    const rules = [
      { rule: createThrowingRule(), config: createRuleConfig({ ruleId: 'test/throwing' }) },
      { rule: createPassingRule('rule-ok'), config: createRuleConfig({ ruleId: 'rule-ok' }) },
    ];

    const results = await runRules(rules, providers, '/root');

    expect(results).toHaveLength(2);
    expect(results[0].error).toBeDefined();
    expect(results[1].error).toBeUndefined();
  });

  it('runs rules in parallel', async () => {
    const executionOrder: string[] = [];
    const createDelayedRule = (name: string, delayMs: number): RuleDefinition => ({
      name,
      description: `Delayed rule (${delayMs}ms)`,
      needs: [],
      async check() {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        executionOrder.push(name);
      },
    });

    const rules = [
      { rule: createDelayedRule('slow', 50), config: createRuleConfig({ ruleId: 'slow' }) },
      { rule: createDelayedRule('fast', 10), config: createRuleConfig({ ruleId: 'fast' }) },
    ];

    await runRules(rules, providers, '/root');

    // Since they run in parallel, fast completes first
    expect(executionOrder[0]).toBe('fast');
    expect(executionOrder[1]).toBe('slow');
  });

  it('works correctly with only one rule', async () => {
    const rules = [{ rule: createFailingRule(), config: createRuleConfig() }];

    const results = await runRules(rules, providers, '/root');

    expect(results).toHaveLength(1);
    expect(results[0].violations).toHaveLength(1);
  });

  it('collects each error individually even when all rules throw', async () => {
    const rules = [
      {
        rule: createThrowingRule(new Error('Error A')),
        config: createRuleConfig({ ruleId: 'rule-a' }),
      },
      {
        rule: createThrowingRule(new Error('Error B')),
        config: createRuleConfig({ ruleId: 'rule-b' }),
      },
    ];

    const results = await runRules(rules, providers, '/root');

    expect(results).toHaveLength(2);
    expect(results[0].error?.message).toBe('Error A');
    expect(results[1].error?.message).toBe('Error B');
  });
});
