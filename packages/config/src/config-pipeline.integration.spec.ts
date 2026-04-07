import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFile } from './load';
import { resolveConfig } from './resolve';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** Creates a temporary directory from a file structure map */
async function createFixtureDir(
  structure: Readonly<Record<string, string | null>> = {},
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-config-test-'));

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

describe('Config pipeline integration test', () => {
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

  describe('loadConfigFile → resolveConfig', () => {
    it('로드된 config을 ResolvedConfig으로 정규화한다', async () => {
      const { rootDir } = await setup({
        'lodestar.config.mjs': `export default {
          plugins: ['@retemper/plugin-architecture'],
          rules: { 'architecture/no-circular': 'error' },
        };\n`,
      });

      const written = await loadConfigFile(rootDir);
      expect(written).not.toBeNull();

      const resolved = resolveConfig(written!, rootDir);

      expect(resolved.rootDir).toBe(rootDir);
      expect(resolved.plugins).toHaveLength(1);
      expect(resolved.rules.get('architecture/no-circular')).toStrictEqual({
        ruleId: 'architecture/no-circular',
        severity: 'error',
        options: {},
      });
    });

    it('flat config 배열을 정규화한다', async () => {
      const { rootDir } = await setup({
        'lodestar.config.mjs': `export default [
          { rules: { 'a/rule': 'error' } },
          { files: ['src/**'], rules: { 'b/rule': 'warn' } },
        ];\n`,
      });

      const written = await loadConfigFile(rootDir);
      const resolved = resolveConfig(written!, rootDir);

      expect(resolved.rules.has('a/rule')).toBe(true);
      expect(resolved.scopedRules).toHaveLength(1);
      expect(resolved.scopedRules[0].rules.has('b/rule')).toBe(true);
    });

    it('config이 없는 디렉토리에서 빈 config을 정규화한다', () => {
      const resolved = resolveConfig({}, '/tmp/empty');

      expect(resolved.rootDir).toBe('/tmp/empty');
      expect(resolved.plugins).toStrictEqual([]);
      expect(resolved.rules.size).toBe(0);
      expect(resolved.scopedRules).toHaveLength(0);
      expect(resolved.adapters).toHaveLength(0);
    });
  });
});
