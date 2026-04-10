import { describe, it, expect } from 'vitest';
import type { WrittenConfig } from '@retemper/lodestar';
import type { ToolAdapter } from '@retemper/lodestar-types';
import { filterRules, filterAdapters, matchesRuleFilter } from './filter';

describe('matchesRuleFilter', () => {
  it('exact match', () => {
    expect(matchesRuleFilter('architecture/layers', ['architecture/layers'])).toBe(true);
  });

  it('no match', () => {
    expect(matchesRuleFilter('naming/file', ['architecture/layers'])).toBe(false);
  });

  it('wildcard prefix match', () => {
    expect(matchesRuleFilter('architecture/layers', ['architecture/*'])).toBe(true);
    expect(matchesRuleFilter('architecture/boundaries', ['architecture/*'])).toBe(true);
  });

  it('wildcard does not match other prefixes', () => {
    expect(matchesRuleFilter('naming/file', ['architecture/*'])).toBe(false);
  });

  it('multiple patterns — matches if any pattern matches', () => {
    expect(matchesRuleFilter('naming/file', ['architecture/*', 'naming/file'])).toBe(true);
  });
});

describe('filterRules', () => {
  it('filters rules in a single block', () => {
    const config: WrittenConfig = {
      rules: {
        'architecture/layers': 'error',
        'naming/file': 'warn',
      },
    };

    const result = filterRules(config, ['architecture/*']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].rules).toStrictEqual({ 'architecture/layers': 'error' });
  });

  it('filters rules in an array of blocks', () => {
    const config: WrittenConfig = [
      { rules: { 'a/one': 'error', 'b/two': 'warn' } },
      { rules: { 'a/three': 'error' } },
    ];

    const result = filterRules(config, ['a/*']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].rules).toStrictEqual({ 'a/one': 'error' });
    expect(blocks[1].rules).toStrictEqual({ 'a/three': 'error' });
  });

  it('passes through blocks without rules', () => {
    const config: WrittenConfig = { plugins: [] };
    const result = filterRules(config, ['test/*']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0]).toStrictEqual({ plugins: [] });
  });
});

function stubAdapter(name: string): ToolAdapter {
  return { name, config: {} };
}

describe('filterAdapters', () => {
  it('filters adapters by name', () => {
    const config: WrittenConfig = {
      adapters: [stubAdapter('eslint'), stubAdapter('prettier'), stubAdapter('husky')],
    };

    const result = filterAdapters(config, ['prettier']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].adapters).toHaveLength(1);
    expect(blocks[0].adapters![0].name).toBe('prettier');
  });

  it('keeps multiple named adapters', () => {
    const config: WrittenConfig = {
      adapters: [stubAdapter('eslint'), stubAdapter('prettier'), stubAdapter('husky')],
    };

    const result = filterAdapters(config, ['eslint', 'prettier']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].adapters).toHaveLength(2);
  });

  it('returns empty adapter list when no names match', () => {
    const config: WrittenConfig = {
      adapters: [stubAdapter('eslint')],
    };

    const result = filterAdapters(config, ['nonexistent']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].adapters).toHaveLength(0);
  });

  it('passes through blocks without adapters', () => {
    const config: WrittenConfig = { rules: { 'test/rule': 'error' } };
    const result = filterAdapters(config, ['prettier']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].rules).toStrictEqual({ 'test/rule': 'error' });
    expect(blocks[0].adapters).toBeUndefined();
  });

  it('works with array config blocks', () => {
    const config: WrittenConfig = [
      { adapters: [stubAdapter('eslint'), stubAdapter('prettier')] },
      { adapters: [stubAdapter('husky')] },
    ];

    const result = filterAdapters(config, ['prettier', 'husky']);
    const blocks = Array.isArray(result) ? result : [result];
    expect(blocks[0].adapters).toHaveLength(1);
    expect(blocks[0].adapters![0].name).toBe('prettier');
    expect(blocks[1].adapters).toHaveLength(1);
    expect(blocks[1].adapters![0].name).toBe('husky');
  });
});
