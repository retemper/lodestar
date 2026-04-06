import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { biomeAdapter, buildBiomeConfig, buildBiomeRules } from './adapter';

describe('buildBiomeRules', () => {
  it('플랫한 규칙 맵을 그룹/규칙 구조로 변환한다', () => {
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

  it('슬래시가 없는 키는 무시한다', () => {
    const result = buildBiomeRules({
      'style/useConst': 'error',
      invalidKey: 'warn',
    });

    expect(result).toStrictEqual({
      style: { useConst: 'error' },
    });
  });

  it('빈 규칙 맵은 빈 객체를 반환한다', () => {
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

  /** 임시 디렉토리 생성 */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'biome-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('biome.json이 없으면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    const adapter = biomeAdapter({ rules: { 'style/useConst': 'error' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('biome/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('biome.json 내용이 config과 다르면 setup violation을 보고한다', async () => {
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

  it('biome.json 내용이 일치하면 violation이 없다', async () => {
    const rootDir = await createTempDir();
    const config = { rules: { 'style/useConst': 'error' } as const };
    const expected = JSON.stringify(buildBiomeConfig(config), null, 2) + '\n';
    await writeFile(join(rootDir, 'biome.json'), expected, 'utf-8');

    const adapter = biomeAdapter(config);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('fix로 biome.json을 생성한다', async () => {
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
  it('규칙이 있으면 linter 섹션을 생성한다', () => {
    const result = buildBiomeConfig({
      rules: { 'style/useConst': 'error' },
    });

    expect(result.linter).toStrictEqual({
      enabled: true,
      rules: { style: { useConst: 'error' } },
    });
  });

  it('ignore 패턴이 있으면 files.ignore를 생성한다', () => {
    const result = buildBiomeConfig({
      ignore: ['dist/**', 'node_modules/**'],
    });

    expect(result.files).toStrictEqual({
      ignore: ['dist/**', 'node_modules/**'],
    });
  });

  it('extends가 있으면 배열로 감싼다', () => {
    const result = buildBiomeConfig({
      extends: './base-biome.json',
    });

    expect(result.extends).toStrictEqual(['./base-biome.json']);
  });

  it('빈 config은 스키마만 포함한다', () => {
    const result = buildBiomeConfig({});

    expect(result.$schema).toBeDefined();
    expect(result.linter).toBeUndefined();
    expect(result.files).toBeUndefined();
  });
});
