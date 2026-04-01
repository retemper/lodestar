import { describe, it, expect } from 'vitest';
import { mergeConfigs } from './merge.js';

describe('mergeConfigs', () => {
  describe('plugins merge', () => {
    it('returns an empty array when both base and override are empty', () => {
      const result = mergeConfigs({}, {});
      expect(result.plugins).toStrictEqual([]);
    });

    it('preserves base when only base has plugins', () => {
      const result = mergeConfigs({ plugins: ['plugin-a', 'plugin-b'] }, {});
      expect(result.plugins).toStrictEqual(['plugin-a', 'plugin-b']);
    });

    it('adds override when only override has plugins', () => {
      const result = mergeConfigs({}, { plugins: ['plugin-a'] });
      expect(result.plugins).toStrictEqual(['plugin-a']);
    });

    it('override replaces base for plugins with the same name', () => {
      const result = mergeConfigs(
        { plugins: [['plugin-a', { v: 1 }]] },
        { plugins: [['plugin-a', { v: 2 }]] },
      );
      expect(result.plugins).toStrictEqual([['plugin-a', { v: 2 }]]);
    });

    it('replaces a string plugin in base with a tuple plugin from override', () => {
      const result = mergeConfigs(
        { plugins: ['plugin-a'] },
        { plugins: [['plugin-a', { strict: true }]] },
      );
      expect(result.plugins).toStrictEqual([['plugin-a', { strict: true }]]);
    });

    it('appends new plugins at the end', () => {
      const result = mergeConfigs({ plugins: ['plugin-a'] }, { plugins: ['plugin-b'] });
      expect(result.plugins).toStrictEqual(['plugin-a', 'plugin-b']);
    });

    it('handles replacing existing plugins and adding new ones simultaneously', () => {
      const result = mergeConfigs(
        { plugins: ['plugin-a', 'plugin-b'] },
        { plugins: [['plugin-a', { v: 2 }], 'plugin-c'] },
      );
      expect(result.plugins).toStrictEqual([['plugin-a', { v: 2 }], 'plugin-b', 'plugin-c']);
    });

    it('preserves plugin order — replaced plugins stay at their original position', () => {
      const result = mergeConfigs(
        { plugins: ['a', 'b', 'c'] },
        { plugins: [['b', { opt: true }]] },
      );
      expect(result.plugins).toStrictEqual(['a', ['b', { opt: true }], 'c']);
    });
  });

  describe('rules merge', () => {
    it('returns an empty object when both base and override are empty', () => {
      const result = mergeConfigs({}, {});
      expect(result.rules).toStrictEqual({});
    });

    it('override rule overwrites the same rule in base', () => {
      const result = mergeConfigs(
        { rules: { 'rule-a': 'error' } },
        { rules: { 'rule-a': 'warn' } },
      );
      expect(result.rules).toStrictEqual({ 'rule-a': 'warn' });
    });

    it('can overwrite severity with an object config', () => {
      const result = mergeConfigs(
        { rules: { 'rule-a': 'error' } },
        { rules: { 'rule-a': { severity: 'warn', options: { max: 3 } } } },
      );
      expect(result.rules?.['rule-a']).toStrictEqual({ severity: 'warn', options: { max: 3 } });
    });

    it('preserves rules that only exist in base', () => {
      const result = mergeConfigs(
        { rules: { 'rule-a': 'error', 'rule-b': 'warn' } },
        { rules: { 'rule-b': 'off' } },
      );
      expect(result.rules).toStrictEqual({
        'rule-a': 'error',
        'rule-b': 'off',
      });
    });

    it('adds rules that only exist in override', () => {
      const result = mergeConfigs(
        { rules: { 'rule-a': 'error' } },
        { rules: { 'rule-b': 'warn' } },
      );
      expect(result.rules).toStrictEqual({
        'rule-a': 'error',
        'rule-b': 'warn',
      });
    });
  });

  describe('include/exclude/baseline merge', () => {
    it('ignores base when override has include', () => {
      const result = mergeConfigs({ include: ['src/**'] }, { include: ['lib/**'] });
      expect(result.include).toStrictEqual(['lib/**']);
    });

    it('preserves base when override has no include', () => {
      const result = mergeConfigs({ include: ['src/**'] }, {});
      expect(result.include).toStrictEqual(['src/**']);
    });

    it('ignores base when override has exclude', () => {
      const result = mergeConfigs({ exclude: ['test/**'] }, { exclude: ['e2e/**'] });
      expect(result.exclude).toStrictEqual(['e2e/**']);
    });

    it('ignores base when override has baseline', () => {
      const result = mergeConfigs({ baseline: true }, { baseline: 'custom.json' });
      expect(result.baseline).toBe('custom.json');
    });

    it('preserves base when override has no baseline', () => {
      const result = mergeConfigs({ baseline: true }, {});
      expect(result.baseline).toBe(true);
    });

    it('returns undefined when both sides are empty', () => {
      const result = mergeConfigs({}, {});
      expect(result.include).toBeUndefined();
      expect(result.exclude).toBeUndefined();
      expect(result.baseline).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('applies user overrides to a preset-based config', () => {
      const preset = {
        plugins: ['@lodestar/plugin-structure', '@lodestar/plugin-boundary'] as const,
        rules: {
          'structure/directory-exists': 'error' as const,
          'boundary/no-deep-import': 'error' as const,
        },
        include: ['src/**'],
      };
      const userConfig = {
        plugins: ['@lodestar/plugin-deps'] as const,
        rules: {
          'boundary/no-deep-import': 'warn' as const,
          'deps/no-circular': 'error' as const,
        },
      };

      const result = mergeConfigs(preset, userConfig);

      expect(result.plugins).toStrictEqual([
        '@lodestar/plugin-structure',
        '@lodestar/plugin-boundary',
        '@lodestar/plugin-deps',
      ]);
      expect(result.rules).toStrictEqual({
        'structure/directory-exists': 'error',
        'boundary/no-deep-import': 'warn',
        'deps/no-circular': 'error',
      });
      expect(result.include).toStrictEqual(['src/**']);
    });
  });
});
