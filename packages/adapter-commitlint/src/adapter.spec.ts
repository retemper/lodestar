import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commitlintAdapter, buildCommitlintConfig } from './adapter';

describe('buildCommitlintConfig', () => {
  it('extends만 설정하면 extends만 포함한다', () => {
    const result = buildCommitlintConfig({
      extends: ['@commitlint/config-conventional'],
    });

    expect(result).toStrictEqual({
      extends: ['@commitlint/config-conventional'],
    });
  });

  it('rules만 설정하면 rules만 포함한다', () => {
    const result = buildCommitlintConfig({
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });

    expect(result).toStrictEqual({
      rules: { 'type-enum': [2, 'always', ['feat', 'fix', 'chore']] },
    });
  });

  it('extends와 rules를 모두 포함한다', () => {
    const result = buildCommitlintConfig({
      extends: ['@commitlint/config-conventional'],
      rules: { 'scope-case': [2, 'always', 'kebab-case'] },
    });

    expect(result).toStrictEqual({
      extends: ['@commitlint/config-conventional'],
      rules: { 'scope-case': [2, 'always', 'kebab-case'] },
    });
  });

  it('빈 config은 빈 객체를 반환한다', () => {
    const result = buildCommitlintConfig({});
    expect(result).toStrictEqual({});
  });

  it('빈 배열 extends는 포함하지 않는다', () => {
    const result = buildCommitlintConfig({ extends: [] });
    expect(result).toStrictEqual({});
  });

  it('빈 객체 rules는 포함하지 않는다', () => {
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

  /** 임시 디렉토리 생성 */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'commitlint-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('.commitlintrc.json이 없으면 setup violation을 보고한다', async () => {
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

  it('.commitlintrc.json 내용이 config과 다르면 setup violation을 보고한다', async () => {
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

  it('.commitlintrc.json 내용이 일치하면 violation이 없다', async () => {
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

  it('fix로 .commitlintrc.json을 생성한다', async () => {
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
