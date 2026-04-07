import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFile } from './load';
import type { WrittenConfigBlock } from '@lodestar/types';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** 파일 구조 맵으로 임시 디렉토리 생성 */
async function createFixtureDir(
  structure: Readonly<Record<string, string | null>> = {},
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-load-test-'));

  for (const [relativePath, content] of Object.entries(structure)) {
    const fullPath = join(rootDir, relativePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });

    await (content === null
      ? mkdir(fullPath, { recursive: true })
      : writeFile(fullPath, content, 'utf-8'));
  }

  return {
    rootDir,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

/** config을 단일 블록으로 변환 (flat config 호환) */
function firstBlock(config: unknown): WrittenConfigBlock {
  if (Array.isArray(config)) return config[0];
  return config as WrittenConfigBlock;
}

describe('loadConfigFile', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  async function setup(structure: Record<string, string | null> = {}) {
    const fixture = await createFixtureDir(structure);
    fixtures.push(fixture);
    return fixture;
  }

  it('.mjs 파일을 로드한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.mjs': `export default { rules: { 'test/rule': 'error' } };\n`,
    });

    const config = await loadConfigFile(rootDir);
    const block = firstBlock(config);

    expect(config).not.toBeNull();
    expect(block.rules?.['test/rule']).toBe('error');
  });

  it('.js 파일을 로드한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.js': `export default { plugins: ['test-plugin'] };\n`,
    });

    const config = await loadConfigFile(rootDir);
    const block = firstBlock(config);

    expect(config).not.toBeNull();
    expect(block.plugins).toStrictEqual(['test-plugin']);
  });

  it('config 파일이 없으면 null을 반환한다', async () => {
    const { rootDir } = await setup({});
    const config = await loadConfigFile(rootDir);
    expect(config).toBeNull();
  });

  it('default export가 없는 모듈은 null을 반환한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.mjs': `export const config = { rules: {} };\n`,
    });

    const config = await loadConfigFile(rootDir);
    expect(config).toBeNull();
  });

  it('빈 객체 config도 로드한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.mjs': `export default {};\n`,
    });

    const config = await loadConfigFile(rootDir);
    expect(config).toStrictEqual({});
  });

  it('.ts 파일을 jiti를 통해 로드한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.ts': `export default { rules: { 'ts/rule': 'warn' } };\n`,
    });

    const config = await loadConfigFile(rootDir);
    const block = firstBlock(config);

    expect(config).not.toBeNull();
    expect(block.rules?.['ts/rule']).toBe('warn');
  });

  it('배열 config(flat config)을 로드한다', async () => {
    const { rootDir } = await setup({
      'lodestar.config.mjs': `export default [
        { rules: { 'a/rule': 'error' } },
        { files: ['src/**'], rules: { 'b/rule': 'warn' } },
      ];\n`,
    });

    const config = await loadConfigFile(rootDir);

    expect(Array.isArray(config)).toBe(true);
    const blocks = config as WrittenConfigBlock[];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].rules?.['a/rule']).toBe('error');
    expect(blocks[1].files).toStrictEqual(['src/**']);
  });
});
