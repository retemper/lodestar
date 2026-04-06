import { describe, it, expect } from 'vitest';
import { validateConfig, findSimilar, levenshtein } from './validate';
import type { ResolvedConfig } from '@lodestar/types';

/** Create a minimal resolved config for testing */
function makeConfig(ruleIds: string[]): ResolvedConfig {
  const rules = new Map(
    ruleIds.map((id) => [
      id,
      {
        ruleId: id,
        severity: 'error' as const,
        options: {},
        include: [],
        exclude: [],
      },
    ]),
  );
  return {
    rootDir: '/test',
    plugins: [],
    rules,
    include: [],
    exclude: [],
    baseline: null,
  };
}

describe('validateConfig', () => {
  it('returns no diagnostics for valid config', () => {
    const config = makeConfig(['fs-layout/directory-exists', 'dependency-graph/no-circular']);
    const available = new Set(['fs-layout/directory-exists', 'dependency-graph/no-circular']);

    const diagnostics = validateConfig(config, available);

    expect(diagnostics).toHaveLength(0);
  });

  it('reports error for unknown rule', () => {
    const config = makeConfig(['typo/nonexistent']);
    const available = new Set(['fs-layout/directory-exists']);

    const diagnostics = validateConfig(config, available);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].level).toBe('error');
    expect(diagnostics[0].message).toContain('Unknown rule "typo/nonexistent"');
  });

  it('suggests similar rule name for typos', () => {
    const config = makeConfig(['fs-layout/diretory-exists']);
    const available = new Set(['fs-layout/directory-exists', 'dependency-graph/no-circular']);

    const diagnostics = validateConfig(config, available);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Did you mean "fs-layout/directory-exists"');
  });

  it('reports multiple unknown rules', () => {
    const config = makeConfig(['fake/rule-a', 'fake/rule-b']);
    const available = new Set(['real/rule']);

    const diagnostics = validateConfig(config, available);

    expect(diagnostics).toHaveLength(2);
  });

  it('does not suggest when no similar name exists', () => {
    const config = makeConfig(['completely-different']);
    const available = new Set(['fs-layout/directory-exists']);

    const diagnostics = validateConfig(config, available);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).not.toContain('Did you mean');
  });
});

describe('findSimilar', () => {
  it('finds closest match', () => {
    const candidates = new Set(['apple', 'banana', 'cherry']);
    expect(findSimilar('aple', candidates)).toBe('apple');
  });

  it('returns null when nothing is close', () => {
    const candidates = new Set(['xyz']);
    expect(findSimilar('abcdefghij', candidates)).toBeNull();
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('calculates correct distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('directory', 'diretory')).toBe(1);
  });
});
