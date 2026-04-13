import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { biomeAdapter, buildBiomeConfig, buildBiomeRules } from './adapter';

describe('buildBiomeRules', () => {
  it('converts flat rule map to group/rule structure', () => {
    const result = buildBiomeRules({
      'style/noNonNullAssertion': 'warn',
      'style/useConst': 'error',
      'suspicious/noExplicitAny': 'warn',
    });

    expect(result).toStrictEqual({
      style: {
        noNonNullAssertion: 'warn',
        useConst: 'error',
      },
      suspicious: {
        noExplicitAny: 'warn',
      },
    });
  });

  it('ignores keys without slash', () => {
    const result = buildBiomeRules({
      'style/useConst': 'error',
      invalidKey: 'warn',
    });

    expect(result).toStrictEqual({
      style: { useConst: 'error' },
    });
  });

  it('returns empty object for empty rule map', () => {
    const result = buildBiomeRules({});
    expect(result).toStrictEqual({});
  });
});

describe('biomeAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Creates a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'biome-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('reports setup violation when biome.json is missing', async () => {
    const rootDir = await createTempDir();
    const adapter = biomeAdapter({ rules: { 'style/useConst': 'error' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('biome/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports setup violation when biome.json content differs from config', async () => {
    const rootDir = await createTempDir();
    await writeFile(join(rootDir, 'biome.json'), '{}\n', 'utf-8');

    const adapter = biomeAdapter({ rules: { 'style/useConst': 'error' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('biome/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('no violation when biome.json content matches', async () => {
    const rootDir = await createTempDir();
    const config = { rules: { 'style/useConst': 'error' } as const };
    const expected = JSON.stringify(buildBiomeConfig(config), null, 2) + '\n';
    await writeFile(join(rootDir, 'biome.json'), expected, 'utf-8');

    const adapter = biomeAdapter(config);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates biome.json via fix', async () => {
    const rootDir = await createTempDir();
    const adapter = biomeAdapter({ rules: { 'style/useConst': 'error' } });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, 'biome.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.$schema).toBeDefined();
    expect(parsed.linter.rules.style.useConst).toBe('error');

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});

describe('buildBiomeConfig', () => {
  it('creates linter section when rules exist', () => {
    const result = buildBiomeConfig({
      rules: { 'style/useConst': 'error' },
    });

    expect(result.linter).toStrictEqual({
      enabled: true,
      rules: { style: { useConst: 'error' } },
    });
  });

  it('creates files.ignore when ignore patterns are present', () => {
    const result = buildBiomeConfig({
      ignore: ['dist/**', 'node_modules/**'],
    });

    expect(result.files).toStrictEqual({
      ignore: ['dist/**', 'node_modules/**'],
    });
  });

  it('wraps extends in array when present', () => {
    const result = buildBiomeConfig({
      extends: './base-biome.json',
    });

    expect(result.extends).toStrictEqual(['./base-biome.json']);
  });

  it('includes only schema for empty config', () => {
    const result = buildBiomeConfig({});

    expect(result.$schema).toBeDefined();
    expect(result.linter).toBeUndefined();
    expect(result.files).toBeUndefined();
  });
});
