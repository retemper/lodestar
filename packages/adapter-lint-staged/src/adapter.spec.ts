import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lintStagedAdapter, buildLintStagedConfig } from './adapter';

describe('buildLintStagedConfig', () => {
  it('commands를 그대로 반환한다', () => {
    const result = buildLintStagedConfig({
      commands: { '*.ts': 'eslint --fix', '*.css': 'stylelint --fix' },
    });

    expect(result).toStrictEqual({
      '*.ts': 'eslint --fix',
      '*.css': 'stylelint --fix',
    });
  });

  it('배열 형태의 명령어를 지원한다', () => {
    const result = buildLintStagedConfig({
      commands: { '*.ts': ['eslint --fix', 'prettier --write'] },
    });

    expect(result).toStrictEqual({
      '*.ts': ['eslint --fix', 'prettier --write'],
    });
  });

  it('빈 commands는 빈 객체를 반환한다', () => {
    const result = buildLintStagedConfig({ commands: {} });
    expect(result).toStrictEqual({});
  });
});

describe('lintStagedAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Creates a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'lint-staged-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('.lintstagedrc.json이 없으면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    const adapter = lintStagedAdapter({ commands: { '*.ts': 'eslint --fix' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('lint-staged/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('.lintstagedrc.json 내용이 config과 다르면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    await writeFile(join(rootDir, '.lintstagedrc.json'), '{"*.ts": "prettier --write"}\n', 'utf-8');

    const adapter = lintStagedAdapter({ commands: { '*.ts': 'eslint --fix' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('lint-staged/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('.lintstagedrc.json 내용이 일치하면 violation이 없다', async () => {
    const rootDir = await createTempDir();
    const expected = JSON.stringify({ '*.ts': 'eslint --fix' }, null, 2) + '\n';
    await writeFile(join(rootDir, '.lintstagedrc.json'), expected, 'utf-8');

    const adapter = lintStagedAdapter({ commands: { '*.ts': 'eslint --fix' } });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('fix로 .lintstagedrc.json을 생성한다', async () => {
    const rootDir = await createTempDir();
    const adapter = lintStagedAdapter({
      commands: { '*.ts': 'eslint --fix', '*.css': 'stylelint --fix' },
    });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, '.lintstagedrc.json'), 'utf-8');
    expect(JSON.parse(content)).toStrictEqual({
      '*.ts': 'eslint --fix',
      '*.css': 'stylelint --fix',
    });

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});
