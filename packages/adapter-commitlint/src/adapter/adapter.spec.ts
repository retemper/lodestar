import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commitlintAdapter, buildCommitlintConfig } from './adapter';

describe('buildCommitlintConfig', () => {
  it('includes only extends when only extends is set', () => {
    const result = buildCommitlintConfig({
      extends: ['@commitlint/config-conventional'],
    });

    expect(result).toStrictEqual({
      extends: ['@commitlint/config-conventional'],
    });
  });

  it('includes only rules when only rules is set', () => {
    const result = buildCommitlintConfig({
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });

    expect(result).toStrictEqual({
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });
  });

  it('includes both extends and rules', () => {
    const result = buildCommitlintConfig({
      extends: ['@commitlint/config-conventional'],
      rules: { 'scope-case': [2, 'always', 'kebab-case'] },
    });

    expect(result).toStrictEqual({
      extends: ['@commitlint/config-conventional'],
      rules: { 'scope-case': [2, 'always', 'kebab-case'] },
    });
  });

  it('returns empty object for empty config', () => {
    const result = buildCommitlintConfig({});
    expect(result).toStrictEqual({});
  });

  it('does not include empty array extends', () => {
    const result = buildCommitlintConfig({ extends: [] });
    expect(result).toStrictEqual({});
  });

  it('does not include empty object rules', () => {
    const result = buildCommitlintConfig({ rules: {} });
    expect(result).toStrictEqual({});
  });
});

describe('commitlintAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Creates a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'commitlint-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('reports setup violation when .commitlintrc.json is missing', async () => {
    const rootDir = await createTempDir();
    const adapter = commitlintAdapter({
      extends: ['@commitlint/config-conventional'],
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('commitlint/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports setup violation when .commitlintrc.json content differs from config', async () => {
    const rootDir = await createTempDir();
    await writeFile(
      join(rootDir, '.commitlintrc.json'),
      '{"extends": ["other-config"]}\n',
      'utf-8',
    );

    const adapter = commitlintAdapter({
      extends: ['@commitlint/config-conventional'],
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('commitlint/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('no violation when .commitlintrc.json content matches', async () => {
    const rootDir = await createTempDir();
    const expected =
      JSON.stringify({ extends: ['@commitlint/config-conventional'] }, null, 2) + '\n';
    await writeFile(join(rootDir, '.commitlintrc.json'), expected, 'utf-8');

    const adapter = commitlintAdapter({
      extends: ['@commitlint/config-conventional'],
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates .commitlintrc.json via fix', async () => {
    const rootDir = await createTempDir();
    const adapter = commitlintAdapter({
      extends: ['@commitlint/config-conventional'],
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, '.commitlintrc.json'), 'utf-8');
    expect(JSON.parse(content)).toStrictEqual({
      extends: ['@commitlint/config-conventional'],
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});
