import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prettierAdapter, buildPrettierConfig, parseCheckOutput } from './adapter';

describe('buildPrettierConfig', () => {
  it('설정된 옵션만 포함한다', () => {
    const result = buildPrettierConfig({
      semi: true,
      singleQuote: true,
    });

    expect(result).toStrictEqual({
      semi: true,
      singleQuote: true,
    });
  });

  it('모든 옵션을 매핑한다', () => {
    const result = buildPrettierConfig({
      printWidth: 100,
      tabWidth: 4,
      useTabs: false,
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
      bracketSpacing: true,
      arrowParens: 'avoid',
      endOfLine: 'lf',
    });

    expect(result).toStrictEqual({
      printWidth: 100,
      tabWidth: 4,
      useTabs: false,
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
      bracketSpacing: true,
      arrowParens: 'avoid',
      endOfLine: 'lf',
    });
  });

  it('빈 config은 빈 객체를 반환한다', () => {
    const result = buildPrettierConfig({});
    expect(result).toStrictEqual({});
  });

  it('adapter 전용 옵션(bin, ignore, include)은 포함하지 않는다', () => {
    const result = buildPrettierConfig({
      bin: '/usr/local/bin/prettier',
      ignore: ['dist/**'],
      include: ['src/**'],
      semi: true,
    });

    expect(result).toStrictEqual({ semi: true });
    expect(result).not.toHaveProperty('bin');
    expect(result).not.toHaveProperty('ignore');
    expect(result).not.toHaveProperty('include');
  });
});

describe('prettierAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Create a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'prettier-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('.prettierrc가 없으면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    const adapter = prettierAdapter({ semi: true });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('prettier/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('.prettierrc 내용이 config과 다르면 setup violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    await writeFile(join(rootDir, '.prettierrc'), '{"semi": false}\n', 'utf-8');

    const adapter = prettierAdapter({ semi: true });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('prettier/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('.prettierrc 내용이 일치하면 violation이 없다', async () => {
    const rootDir = await createTempDir();
    const expected = JSON.stringify({ semi: true }, null, 2) + '\n';
    await writeFile(join(rootDir, '.prettierrc'), expected, 'utf-8');

    const adapter = prettierAdapter({ semi: true });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('fix로 .prettierrc를 생성한다', async () => {
    const rootDir = await createTempDir();
    const adapter = prettierAdapter({ semi: true, singleQuote: true });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, '.prettierrc'), 'utf-8');
    expect(JSON.parse(content)).toStrictEqual({ semi: true, singleQuote: true });

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});

describe('parseCheckOutput', () => {
  it('prettier stderr에서 포맷 안 된 파일 경로를 추출한다', () => {
    const stderr = [
      '[warn] src/index.ts',
      '[warn] src/utils/helper.ts',
      '[warn] Code style issues found in the above file. Run Prettier with --write to fix.',
    ].join('\n');

    const result = parseCheckOutput(stderr, '/project');

    expect(result).toStrictEqual(['src/index.ts', 'src/utils/helper.ts']);
  });

  it('절대 경로를 상대 경로로 변환한다', () => {
    const stderr = '[warn] /project/src/index.ts\n';
    const result = parseCheckOutput(stderr, '/project');

    expect(result).toStrictEqual(['src/index.ts']);
  });

  it('빈 출력이면 빈 배열을 반환한다', () => {
    const result = parseCheckOutput('', '/project');
    expect(result).toStrictEqual([]);
  });

  it('Checking/Code style 라인은 무시한다', () => {
    const stderr = 'Checking formatting...\n[warn] Code style issues found.\n';
    const result = parseCheckOutput(stderr, '/project');
    expect(result).toStrictEqual([]);
  });
});
