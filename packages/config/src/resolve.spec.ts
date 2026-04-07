import { describe, it, expect } from 'vitest';
import type { Plugin } from '@lodestar/types';
import { resolveConfig, resolvePluginEntry, normalizeRuleConfig } from './resolve';

describe('normalizeRuleConfig', () => {
  it('severity 문자열을 기본 options와 함께 정규화한다', () => {
    const result = normalizeRuleConfig('test/rule', 'error');
    expect(result).toStrictEqual({
      ruleId: 'test/rule',
      severity: 'error',
      options: {},
    });
  });

  it('전체 config 객체의 모든 필드를 보존한다', () => {
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

  it('options가 없는 config 객체에 빈 객체를 기본값으로 설정한다', () => {
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
  it('빈 config을 기본값으로 정규화한다', () => {
    const result = resolveConfig({}, '/root');
    expect(result).toStrictEqual({
      rootDir: '/root',
      plugins: [],
      rules: new Map(),
      scopedRules: [],
      adapters: [],
      baseline: null,
    });
  });

  it('rules를 Map으로 정규화한다', () => {
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

  it('배열 config에서 files가 없는 블록은 global rules로 처리한다', () => {
    const result = resolveConfig([{ rules: { 'a/rule': 'error' } }], '/root');

    expect(result.rules.has('a/rule')).toBe(true);
    expect(result.scopedRules).toHaveLength(0);
  });

  it('배열 config에서 files가 있는 블록은 scoped rules로 처리한다', () => {
    const result = resolveConfig([{ files: ['src/**'], rules: { 'a/rule': 'error' } }], '/root');

    expect(result.rules.size).toBe(0);
    expect(result.scopedRules).toHaveLength(1);
    expect(result.scopedRules[0].files).toStrictEqual(['src/**']);
    expect(result.scopedRules[0].rules.has('a/rule')).toBe(true);
  });

  it('여러 블록의 plugins를 중복 없이 합친다', () => {
    const pluginA = { name: 'a', rules: [] };
    const pluginB = { name: 'b', rules: [] };
    const result = resolveConfig(
      [{ plugins: [pluginA] }, { plugins: [pluginA, pluginB] }],
      '/root',
    );

    expect(result.plugins).toHaveLength(2);
  });

  it('여러 블록의 adapters를 name 기준으로 중복 제거한다 (마지막 우선)', () => {
    const adapter1 = { name: 'eslint', config: { v: 1 } };
    const adapter2 = { name: 'eslint', config: { v: 2 } };
    const result = resolveConfig([{ adapters: [adapter1] }, { adapters: [adapter2] }], '/root');

    expect(result.adapters).toHaveLength(1);
    expect(result.adapters[0].config).toStrictEqual({ v: 2 });
  });

  it('scoped rules에 ignores가 없으면 빈 배열을 기본값으로 설정한다', () => {
    const result = resolveConfig(
      [{ files: ['src/**'], rules: { 'a/rule': 'warn' } }],
      '/root',
    );

    expect(result.scopedRules[0].ignores).toStrictEqual([]);
  });

  it('단일 객체 config을 배열처럼 처리한다', () => {
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
  it('[factoryFunction, options] 형식의 플러그인 엔트리를 해석한다', () => {
    const factory = () => ({ name: 'my-plugin', rules: [{ name: 'my-rule' }] });
    const result = resolvePluginEntry([factory, { key: 'value' }]);

    expect(result.name).toBe('my-plugin');
    expect(result.plugin.name).toBe('my-plugin');
    expect(result.options).toStrictEqual({ key: 'value' });
  });

  it('[문자열, options] 형식의 플러그인 엔트리를 해석한다', () => {
    const result = resolvePluginEntry(['my-plugin', { key: 'value' }]);

    expect(result.name).toBe('my-plugin');
    expect(result.options).toStrictEqual({ key: 'value' });
  });

  it('bare function 형식의 플러그인 엔트리를 해석한다', () => {
    const factory = () => ({ name: 'fn-plugin', rules: [] });
    const result = resolvePluginEntry(factory);

    expect(result.name).toBe('fn-plugin');
    expect(result.plugin.name).toBe('fn-plugin');
    expect(result.options).toStrictEqual({});
  });

  it('Plugin 객체를 직접 전달하면 그대로 사용한다', () => {
    const plugin: Plugin = { name: 'direct-plugin', rules: [] };
    const result = resolvePluginEntry(plugin);

    expect(result.name).toBe('direct-plugin');
    expect(result.plugin).toBe(plugin);
    expect(result.options).toStrictEqual({});
  });

  it('문자열 플러그인 엔트리를 해석한다', () => {
    const result = resolvePluginEntry('string-plugin');

    expect(result.name).toBe('string-plugin');
    expect(result.plugin.name).toBe('string-plugin');
    expect(result.options).toStrictEqual({});
  });
});
