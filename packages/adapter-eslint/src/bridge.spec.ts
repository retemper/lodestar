import { describe, it, expect, vi } from 'vitest';
import type { RuleDefinition } from '@lodestar/types';
import { bridgeRule, createESLintPlugin, registerImportChecker } from './bridge.js';

/** Creates a rule definition for testing */
function createTestRule(name = 'test/rule'): RuleDefinition {
  return {
    name,
    description: 'A test rule',
    needs: ['ast'],
    async check(ctx) {
      ctx.report({ message: 'violation' });
    },
  };
}

describe('bridgeRule', () => {
  it('converts to an ESLint RuleModule', () => {
    const rule = createTestRule();
    const eslintRule = bridgeRule(rule);

    expect(eslintRule.meta.type).toBe('problem');
    expect(eslintRule.meta.docs?.description).toBe('A test rule');
    expect(eslintRule.meta.messages).toStrictEqual({ violation: '{{message}}' });
  });

  it('includes schema in ESLint schema when present', () => {
    const rule: RuleDefinition = {
      ...createTestRule(),
      schema: { type: 'object', properties: { max: { type: 'number' } } },
    };
    const eslintRule = bridgeRule(rule);

    expect(eslintRule.meta.schema).toHaveLength(1);
    expect(eslintRule.meta.schema[0]).toStrictEqual(rule.schema);
  });

  it('uses an empty array when schema is absent', () => {
    const rule = createTestRule();
    const eslintRule = bridgeRule(rule);

    expect(eslintRule.meta.schema).toStrictEqual([]);
  });

  it('create returns an ImportDeclaration visitor', () => {
    const rule = createTestRule();
    const eslintRule = bridgeRule(rule);
    const mockContext = {
      options: [],
      filename: 'test.ts',
      cwd: '/root',
      report: vi.fn(),
    };

    const visitors = eslintRule.create(mockContext);

    expect(visitors).toHaveProperty('ImportDeclaration');
    expect(typeof visitors.ImportDeclaration).toBe('function');
  });
});

describe('createESLintPlugin', () => {
  it('bundles multiple rules into an ESLint plugin', () => {
    const rules = [createTestRule('rule-a'), createTestRule('rule-b')];
    const plugin = createESLintPlugin(rules);

    expect(Object.keys(plugin.rules)).toStrictEqual(['rule-a', 'rule-b']);
  });

  it('creates an empty plugin from an empty rules array', () => {
    const plugin = createESLintPlugin([]);

    expect(plugin.rules).toStrictEqual({});
  });

  it('each rule is a valid ESLint RuleModule', () => {
    const rules = [createTestRule('my-rule')];
    const plugin = createESLintPlugin(rules);

    expect(plugin.rules['my-rule'].meta.type).toBe('problem');
    expect(typeof plugin.rules['my-rule'].create).toBe('function');
  });
});

describe('registerImportChecker', () => {
  it('registered checker is invoked when visiting ImportDeclaration', () => {
    const checker = vi.fn();
    registerImportChecker('test/checker-rule', checker);

    const rule: RuleDefinition = {
      name: 'test/checker-rule',
      description: 'Test',
      needs: [],
      async check() {},
    };

    const eslintRule = bridgeRule(rule);
    const mockContext = {
      options: [{ max: 5 }],
      filename: 'src/app.ts',
      cwd: '/root',
      report: vi.fn(),
    };

    const visitors = eslintRule.create(mockContext);
    visitors.ImportDeclaration({
      type: 'ImportDeclaration',
      source: { value: './internal/module' },
      specifiers: [],
      loc: { start: { line: 1, column: 0 } },
    });

    expect(checker).toHaveBeenCalledOnce();
    expect(checker).toHaveBeenCalledWith(
      expect.objectContaining({ options: { max: 5 } }),
      'src/app.ts',
      './internal/module',
    );
  });
});
