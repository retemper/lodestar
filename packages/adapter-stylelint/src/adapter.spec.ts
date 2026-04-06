import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stylelintAdapter, buildStylelintConfig } from './adapter';

describe('buildStylelintConfig', () => {
  it('설정된 옵션만 포함한다', () => {
    const result = buildStylelintConfig({
      extends: ['stylelint-config-standard'],
    });

    expect(result).toStrictEqual({
      extends: ['stylelint-config-standard'],
    });
  });

  it('모든 옵션을 매핑한다', () => {
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

  it('빈 config은 빈 객체를 반환한다', () => {
    const result = buildStylelintConfig({});
    expect(result).toStrictEqual({});
  });

  it('빈 배열과 빈 객체는 포함하지 않는다', () => {
    const result = buildStylelintConfig({
      extends: [],
      rules: {},
      ignore: [],
    });

    expect(result).toStrictEqual({});
  });

  it('adapter 전용 옵션(bin, include)은 포함하지 않는다', () => {
    const result = buildStylelintConfig({
      bin: '/usr/local/bin/stylelint',
      include: ['src/**/*.css'],
      extends: ['stylelint-config-standard'],
    });

    expect(result).toStrictEqual({ extends: ['stylelint-config-standard'] });
    expect(result).not.toHaveProperty('bin');
    expect(result).not.toHaveProperty('include');
  });

  it('ignore는 ignoreFiles로 매핑된다', () => {
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

  /** 임시 디렉토리 생성 */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'stylelint-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('.stylelintrc.json이 없으면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    const adapter = stylelintAdapter({ extends: ['stylelint-config-standard'] });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stylelint/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('.stylelintrc.json 내용이 config과 다르면 setup violation을 보고한다', async () => {
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

  it('.stylelintrc.json 내용이 일치하면 violation이 없다', async () => {
    const rootDir = await createTempDir();
    const cfg = { extends: ['stylelint-config-standard'] as const };
    const expected = JSON.stringify(buildStylelintConfig(cfg), null, 2) + '\n';
    await writeFile(join(rootDir, '.stylelintrc.json'), expected, 'utf-8');

    const adapter = stylelintAdapter(cfg);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('fix로 .stylelintrc.json을 생성한다', async () => {
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
