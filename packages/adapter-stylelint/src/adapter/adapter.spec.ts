import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stylelintAdapter, buildStylelintConfig } from './adapter';

describe('buildStylelintConfig', () => {
  it('includes only configured options', () => {
    const result = buildStylelintConfig({
      extends: ['stylelint-config-standard'],
    });

    expect(result).toStrictEqual({
      extends: ['stylelint-config-standard'],
    });
  });

  it('maps all options', () => {
    const result = buildStylelintConfig({
      extends: ['stylelint-config-standard'],
      rules: { 'color-no-invalid-hex': true },
      ignore: ['dist/**'],
    });

    expect(result).toStrictEqual({
      extends: ['stylelint-config-standard'],
      rules: { 'color-no-invalid-hex': true },
      ignoreFiles: ['dist/**'],
    });
  });

  it('returns empty object for empty config', () => {
    const result = buildStylelintConfig({});
    expect(result).toStrictEqual({});
  });

  it('does not include empty arrays and empty objects', () => {
    const result = buildStylelintConfig({
      extends: [],
      rules: {},
      ignore: [],
    });

    expect(result).toStrictEqual({});
  });

  it('does not include adapter-specific options (bin, include)', () => {
    const result = buildStylelintConfig({
      bin: '/usr/local/bin/stylelint',
      include: ['src/**/*.css'],
      extends: ['stylelint-config-standard'],
    });

    expect(result).toStrictEqual({ extends: ['stylelint-config-standard'] });
    expect(result).not.toHaveProperty('bin');
    expect(result).not.toHaveProperty('include');
  });

  it('maps ignore to ignoreFiles', () => {
    const result = buildStylelintConfig({
      ignore: ['node_modules/**', 'dist/**'],
    });

    expect(result).toStrictEqual({
      ignoreFiles: ['node_modules/**', 'dist/**'],
    });
    expect(result).not.toHaveProperty('ignore');
  });
});

describe('stylelintAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Create a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'stylelint-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('reports setup violation when .stylelintrc.json is missing', async () => {
    const rootDir = await createTempDir();
    const adapter = stylelintAdapter({ extends: ['stylelint-config-standard'] });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stylelint/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports setup violation when .stylelintrc.json content differs from config', async () => {
    const rootDir = await createTempDir();
    await writeFile(join(rootDir, '.stylelintrc.json'), '{}\n', 'utf-8');

    const adapter = stylelintAdapter({ extends: ['stylelint-config-standard'] });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stylelint/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('no violation when .stylelintrc.json content matches', async () => {
    const rootDir = await createTempDir();
    const cfg = { extends: ['stylelint-config-standard'] as const };
    const expected = JSON.stringify(buildStylelintConfig(cfg), null, 2) + '\n';
    await writeFile(join(rootDir, '.stylelintrc.json'), expected, 'utf-8');

    const adapter = stylelintAdapter(cfg);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates .stylelintrc.json via fix', async () => {
    const rootDir = await createTempDir();
    const adapter = stylelintAdapter({
      extends: ['stylelint-config-standard'],
      rules: { 'color-no-invalid-hex': true },
    });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, '.stylelintrc.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toStrictEqual({
      extends: ['stylelint-config-standard'],
      rules: { 'color-no-invalid-hex': true },
    });

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});
