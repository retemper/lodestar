import { describe, it, expect } from 'vitest';
import { resolveConfig, normalizeRuleConfig, normalizeBaseline } from './resolve.js';

describe('normalizeBaseline', () => {
  it('returns the default baseline file path when true is passed', () => {
    expect(normalizeBaseline(true)).toBe('.lodestar-baseline.json');
  });

  it('returns the string as-is when a string is passed', () => {
    expect(normalizeBaseline('custom-baseline.json')).toBe('custom-baseline.json');
  });

  it('returns an empty string when an empty string is passed', () => {
    expect(normalizeBaseline('')).toBe('');
  });

  it('returns null when undefined is passed', () => {
    expect(normalizeBaseline(undefined)).toBeNull();
  });

  it('returns null when false is passed', () => {
    expect(normalizeBaseline(false)).toBeNull();
  });
});

describe('normalizeRuleConfig', () => {
  it('normalizes a severity string with default options', () => {
    const result = normalizeRuleConfig('my-rule', 'error');
    expect(result).toStrictEqual({
      ruleId: 'my-rule',
      severity: 'error',
      options: {},
      include: [],
      exclude: [],
    });
  });

  it('normalizes warn severity', () => {
    const result = normalizeRuleConfig('my-rule', 'warn');
    expect(result.severity).toBe('warn');
  });

  it('normalizes off severity', () => {
    const result = normalizeRuleConfig('my-rule', 'off');
    expect(result.severity).toBe('off');
  });

  it('preserves all fields when a full config object is passed', () => {
    const result = normalizeRuleConfig('my-rule', {
      severity: 'error',
      options: { max: 10 },
      include: ['src/**'],
      exclude: ['test/**'],
    });
    expect(result).toStrictEqual({
      ruleId: 'my-rule',
      severity: 'error',
      options: { max: 10 },
      include: ['src/**'],
      exclude: ['test/**'],
    });
  });

  it('defaults to an empty object when config object has no options', () => {
    const result = normalizeRuleConfig('my-rule', { severity: 'warn' });
    expect(result.options).toStrictEqual({});
  });

  it('defaults to empty arrays when config object has no include/exclude', () => {
    const result = normalizeRuleConfig('my-rule', { severity: 'error' });
    expect(result.include).toStrictEqual([]);
    expect(result.exclude).toStrictEqual([]);
  });

  it('copies include/exclude array references to prevent mutation of the original', () => {
    const include = ['src/**'];
    const exclude = ['test/**'];
    const result = normalizeRuleConfig('my-rule', {
      severity: 'error',
      include,
      exclude,
    });
    expect(result.include).toStrictEqual(include);
    expect(result.include).not.toBe(include);
    expect(result.exclude).toStrictEqual(exclude);
    expect(result.exclude).not.toBe(exclude);
  });
});

describe('resolveConfig', () => {
  it('sets defaults for all fields when an empty config is passed', () => {
    const result = resolveConfig({}, '/root');
    expect(result).toStrictEqual({
      rootDir: '/root',
      plugins: [],
      rules: new Map(),
      include: ['**/*'],
      exclude: ['node_modules/**', 'dist/**'],
      baseline: null,
    });
  });

  it('normalizes a string plugin into {name, options} form', () => {
    const result = resolveConfig({ plugins: ['@lodestar/plugin-structure'] }, '/root');
    expect(result.plugins).toStrictEqual([{ name: '@lodestar/plugin-structure', options: {} }]);
  });

  it('preserves options of a tuple plugin', () => {
    const result = resolveConfig(
      { plugins: [['@lodestar/plugin-boundary', { manifestFile: 'module.json' }]] },
      '/root',
    );
    expect(result.plugins).toStrictEqual([
      { name: '@lodestar/plugin-boundary', options: { manifestFile: 'module.json' } },
    ]);
  });

  it('sets an empty object when a tuple plugin has no options', () => {
    const result = resolveConfig(
      { plugins: [['@lodestar/plugin-deps', undefined as unknown as Record<string, unknown>]] },
      '/root',
    );
    expect(result.plugins[0].options).toStrictEqual({});
  });

  it('normalizes a mix of string and tuple plugins', () => {
    const result = resolveConfig(
      {
        plugins: ['@lodestar/plugin-structure', ['@lodestar/plugin-boundary', { strict: true }]],
      },
      '/root',
    );
    expect(result.plugins).toHaveLength(2);
    expect(result.plugins[0]).toStrictEqual({ name: '@lodestar/plugin-structure', options: {} });
    expect(result.plugins[1]).toStrictEqual({
      name: '@lodestar/plugin-boundary',
      options: { strict: true },
    });
  });

  it('normalizes rules into a Map', () => {
    const result = resolveConfig({ rules: { 'structure/directory-exists': 'error' } }, '/root');
    expect(result.rules.size).toBe(1);
    expect(result.rules.get('structure/directory-exists')).toStrictEqual({
      ruleId: 'structure/directory-exists',
      severity: 'error',
      options: {},
      include: [],
      exclude: [],
    });
  });

  it('normalizes multiple rules at once', () => {
    const result = resolveConfig(
      {
        rules: {
          'rule-a': 'error',
          'rule-b': 'warn',
          'rule-c': { severity: 'error', options: { max: 5 } },
        },
      },
      '/root',
    );
    expect(result.rules.size).toBe(3);
    expect(result.rules.get('rule-a')?.severity).toBe('error');
    expect(result.rules.get('rule-b')?.severity).toBe('warn');
    expect(result.rules.get('rule-c')?.options).toStrictEqual({ max: 5 });
  });

  it('preserves user-defined include/exclude', () => {
    const result = resolveConfig({ include: ['src/**'], exclude: ['vendor/**'] }, '/root');
    expect(result.include).toStrictEqual(['src/**']);
    expect(result.exclude).toStrictEqual(['vendor/**']);
  });

  it('copies include/exclude array references', () => {
    const include = ['src/**'];
    const result = resolveConfig({ include }, '/root');
    expect(result.include).toStrictEqual(include);
    expect(result.include).not.toBe(include);
  });

  it('normalizes baseline true to the default file path', () => {
    const result = resolveConfig({ baseline: true }, '/root');
    expect(result.baseline).toBe('.lodestar-baseline.json');
  });

  it('preserves a baseline string as-is', () => {
    const result = resolveConfig({ baseline: 'my-baseline.json' }, '/root');
    expect(result.baseline).toBe('my-baseline.json');
  });

  it('preserves rootDir as-is', () => {
    const result = resolveConfig({}, '/my/project');
    expect(result.rootDir).toBe('/my/project');
  });

  it('returns an empty Map when rules are absent', () => {
    const result = resolveConfig({}, '/root');
    expect(result.rules).toStrictEqual(new Map());
    expect(result.rules.size).toBe(0);
  });

  it('returns an empty array when plugins are absent', () => {
    const result = resolveConfig({}, '/root');
    expect(result.plugins).toStrictEqual([]);
  });
});
