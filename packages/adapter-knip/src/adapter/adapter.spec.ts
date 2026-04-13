import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { knipAdapter, buildKnipConfig } from './adapter';

describe('buildKnipConfig', () => {
  it('includes only configured options', () => {
    const result = buildKnipConfig({
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
    });

    expect(result).toStrictEqual({
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
    });
  });

  it('maps all options', () => {
    const result = buildKnipConfig({
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
      ignore: ['dist/**'],
      ignoreDependencies: ['lodash'],
    });

    expect(result).toStrictEqual({
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
      ignore: ['dist/**'],
      ignoreDependencies: ['lodash'],
    });
  });

  it('returns empty object for empty config', () => {
    const result = buildKnipConfig({});
    expect(result).toStrictEqual({});
  });

  it('does not include empty arrays', () => {
    const result = buildKnipConfig({
      entry: [],
      project: [],
      ignore: [],
      ignoreDependencies: [],
    });

    expect(result).toStrictEqual({});
  });

  it('does not include adapter-specific options (bin)', () => {
    const result = buildKnipConfig({
      bin: '/usr/local/bin/knip',
      entry: ['src/index.ts'],
    });

    expect(result).toStrictEqual({ entry: ['src/index.ts'] });
    expect(result).not.toHaveProperty('bin');
  });
});

describe('knipAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  /** Create a temporary directory */
  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'knip-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('reports setup violation when knip.json is missing', async () => {
    const rootDir = await createTempDir();
    const adapter = knipAdapter({ entry: ['src/index.ts'] });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('knip/setup');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports setup violation when knip.json content differs from config', async () => {
    const rootDir = await createTempDir();
    await writeFile(join(rootDir, 'knip.json'), '{}\n', 'utf-8');

    const adapter = knipAdapter({ entry: ['src/index.ts'] });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('knip/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].message).toContain('expected:');
    expect(violations[0].message).toContain('actual:');
  });

  it('no violation when knip.json content matches', async () => {
    const rootDir = await createTempDir();
    const cfg = { entry: ['src/index.ts'] };
    const expected = JSON.stringify(buildKnipConfig(cfg), null, 2) + '\n';
    await writeFile(join(rootDir, 'knip.json'), expected, 'utf-8');

    const adapter = knipAdapter(cfg);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates knip.json via fix', async () => {
    const rootDir = await createTempDir();
    const adapter = knipAdapter({ entry: ['src/index.ts'], ignore: ['dist/**'] });

    const violations = await adapter.verifySetup!(rootDir);
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, 'knip.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toStrictEqual({
      entry: ['src/index.ts'],
      ignore: ['dist/**'],
    });

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});
