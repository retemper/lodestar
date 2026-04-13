import { describe, it, expect } from 'vitest';
import type {
  Plugin,
  PluginFactory,
  ReporterFactory,
  WorkspaceReporter,
} from '@retemper/lodestar-types';
import {
  resolveConfig,
  resolvePluginEntry,
  normalizeRuleConfig,
  resolveReporterEntry,
} from './resolve';

describe('normalizeRuleConfig', () => {
  it('normalizes severity string with default options', () => {
    const result = normalizeRuleConfig('test/rule', 'error');
    expect(result).toStrictEqual({
      ruleId: 'test/rule',
      severity: 'error',
      options: {},
    });
  });

  it('preserves all fields of the full config object', () => {
    const result = normalizeRuleConfig('test/rule', {
      severity: 'warn',
      options: { foo: 'bar' },
    });
    expect(result).toStrictEqual({
      ruleId: 'test/rule',
      severity: 'warn',
      options: { foo: 'bar' },
    });
  });

  it('sets empty object as default for config object without options', () => {
    const result = normalizeRuleConfig('test/rule', {
      severity: 'error',
    });
    expect(result).toStrictEqual({
      ruleId: 'test/rule',
      severity: 'error',
      options: {},
    });
  });
});

describe('resolveConfig', () => {
  it('normalizes empty config to defaults', () => {
    const result = resolveConfig({}, '/root');
    expect(result).toStrictEqual({
      rootDir: '/root',
      plugins: [],
      rules: new Map(),
      scopedRules: [],
      adapters: [],
      baseline: null,
      reporters: [],
    });
  });

  it('normalizes rules to Map', () => {
    const result = resolveConfig(
      {
        rules: { 'test/a': 'error', 'test/b': { severity: 'warn', options: { x: 1 } } },
      },
      '/root',
    );

    expect(result.rules.get('test/a')).toStrictEqual({
      ruleId: 'test/a',
      severity: 'error',
      options: {},
    });
    expect(result.rules.get('test/b')).toStrictEqual({
      ruleId: 'test/b',
      severity: 'warn',
      options: { x: 1 },
    });
  });

  it('treats blocks without files as global rules in array config', () => {
    const result = resolveConfig([{ rules: { 'a/rule': 'error' } }], '/root');

    expect(result.rules.has('a/rule')).toBe(true);
    expect(result.scopedRules).toHaveLength(0);
  });

  it('treats blocks with files as scoped rules in array config', () => {
    const result = resolveConfig([{ files: ['src/**'], rules: { 'a/rule': 'error' } }], '/root');

    expect(result.rules.size).toBe(0);
    expect(result.scopedRules).toHaveLength(1);
    expect(result.scopedRules[0].files).toStrictEqual(['src/**']);
    expect(result.scopedRules[0].rules.has('a/rule')).toBe(true);
  });

  it('merges plugins from multiple blocks without duplicates', () => {
    const pluginA = { name: 'a', rules: [] };
    const pluginB = { name: 'b', rules: [] };
    const result = resolveConfig(
      [{ plugins: [pluginA] }, { plugins: [pluginA, pluginB] }],
      '/root',
    );

    expect(result.plugins).toHaveLength(2);
  });

  it('deduplicates adapters from multiple blocks by name (last wins)', () => {
    const adapter1 = { name: 'eslint', config: { v: 1 } };
    const adapter2 = { name: 'eslint', config: { v: 2 } };
    const result = resolveConfig([{ adapters: [adapter1] }, { adapters: [adapter2] }], '/root');

    expect(result.adapters).toHaveLength(1);
    expect(result.adapters[0].config).toStrictEqual({ v: 2 });
  });

  it('sets empty array as default for scoped rules without ignores', () => {
    const result = resolveConfig([{ files: ['src/**'], rules: { 'a/rule': 'warn' } }], '/root');

    expect(result.scopedRules[0].ignores).toStrictEqual([]);
  });

  it('treats single object config as an array', () => {
    const result = resolveConfig(
      {
        rules: { 'test/rule': 'error' },
      },
      '/root',
    );

    expect(result.rules.has('test/rule')).toBe(true);
  });
});

describe('resolvePluginEntry', () => {
  it('resolves [factoryFunction, options] format plugin entry', () => {
    const factory: PluginFactory = () => ({ name: 'my-plugin', rules: [] });
    const result = resolvePluginEntry([factory, { key: 'value' }]);

    expect(result.name).toBe('my-plugin');
    expect(result.plugin.name).toBe('my-plugin');
    expect(result.options).toStrictEqual({ key: 'value' });
    expect(result.plugin.rules).toStrictEqual([]);
  });

  it('resolves [string, options] format plugin entry', () => {
    const result = resolvePluginEntry(['my-plugin', { key: 'value' }]);

    expect(result.name).toBe('my-plugin');
    expect(result.options).toStrictEqual({ key: 'value' });
  });

  it('resolves bare function format plugin entry', () => {
    const factory = () => ({ name: 'fn-plugin', rules: [] });
    const result = resolvePluginEntry(factory);

    expect(result.name).toBe('fn-plugin');
    expect(result.plugin.name).toBe('fn-plugin');
    expect(result.options).toStrictEqual({});
  });

  it('uses Plugin object directly when passed', () => {
    const plugin: Plugin = { name: 'direct-plugin', rules: [] };
    const result = resolvePluginEntry(plugin);

    expect(result.name).toBe('direct-plugin');
    expect(result.plugin).toBe(plugin);
    expect(result.options).toStrictEqual({});
  });

  it('resolves string plugin entry', () => {
    const result = resolvePluginEntry('string-plugin');

    expect(result.name).toBe('string-plugin');
    expect(result.plugin.name).toBe('string-plugin');
    expect(result.options).toStrictEqual({});
  });
});

describe('resolveReporterEntry', () => {
  it('returns null for string entry', () => {
    const result = resolveReporterEntry('console');
    expect(result).toBeNull();
  });

  it('resolves factory object with create method', () => {
    const mockReporter: WorkspaceReporter = {
      name: 'mock',
      onStart() {},
      onViolation() {},
      onComplete() {},
    };
    const factory: ReporterFactory = { name: 'mock', create: () => mockReporter };

    const result = resolveReporterEntry(factory);
    expect(result).toBe(mockReporter);
  });

  it('resolves [factory, options] tuple format', () => {
    const mockReporter: WorkspaceReporter = {
      name: 'mock-with-opts',
      onStart() {},
      onViolation() {},
      onComplete() {},
    };
    const factory: ReporterFactory = { name: 'mock', create: () => mockReporter };

    const result = resolveReporterEntry([factory, { output: 'test.sarif' }]);
    expect(result).toBe(mockReporter);
  });
});

describe('resolveConfig — reporters', () => {
  it('resolves and returns reporters from config block', () => {
    const mockReporter: WorkspaceReporter = {
      name: 'test-reporter',
      onStart() {},
      onViolation() {},
      onComplete() {},
    };
    const factory: ReporterFactory = { name: 'mock', create: () => mockReporter };

    const result = resolveConfig({ plugins: [], rules: {}, reporters: [factory] }, '/root');

    expect(result.reporters).toStrictEqual([mockReporter]);
  });

  it('returns empty array when reporters are missing', () => {
    const result = resolveConfig({ plugins: [], rules: {} }, '/root');

    expect(result.reporters).toStrictEqual([]);
  });
});
