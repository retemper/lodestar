import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prettierAdapter, buildPrettierConfig, parseCheckOutput } from './adapter';

describe('buildPrettierConfig', () => {
  it('includes only configured options', () => {
    const result = buildPrettierConfig({
      semi: true,
      singleQuote: true,
    });

    expect(result).toStrictEqual({
      semi: true,
      singleQuote: true,
    });
  });

  it('maps all options', () => {
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

  it('returns empty object for empty config', () => {
    const result = buildPrettierConfig({});
    expect(result).toStrictEqual({});
  });

  it('does not include adapter-specific options (bin, ignore, include)', () => {
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

  it('reports setup violation when .prettierrc is missing', async () => {
    const rootDir = await createTempDir();
    const adapter = prettierAdapter({ semi: true });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('prettier/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports setup violation when .prettierrc content differs from config', async () => {
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

  it('no violation when .prettierrc content matches', async () => {
    const rootDir = await createTempDir();
    const expected = JSON.stringify({ semi: true }, null, 2) + '\n';
    await writeFile(join(rootDir, '.prettierrc'), expected, 'utf-8');

    const adapter = prettierAdapter({ semi: true });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates .prettierrc via fix', async () => {
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
  it('extracts unformatted file paths from prettier stderr', () => {
    const stderr = [
      '[warn] src/index.ts',
      '[warn] src/utils/helper.ts',
      '[warn] Code style issues found in the above file. Run Prettier with --write to fix.',
    ].join('\n');

    const result = parseCheckOutput(stderr, '/project');

    expect(result).toStrictEqual(['src/index.ts', 'src/utils/helper.ts']);
  });

  it('converts absolute path to relative path', () => {
    const stderr = '[warn] /project/src/index.ts\n';
    const result = parseCheckOutput(stderr, '/project');

    expect(result).toStrictEqual(['src/index.ts']);
  });

  it('returns empty array for empty output', () => {
    const result = parseCheckOutput('', '/project');
    expect(result).toStrictEqual([]);
  });

  it('ignores Checking/Code style lines', () => {
    const stderr = 'Checking formatting...\n[warn] Code style issues found.\n';
    const result = parseCheckOutput(stderr, '/project');
    expect(result).toStrictEqual([]);
  });
});
