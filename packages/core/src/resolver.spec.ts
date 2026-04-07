import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ProviderKey } from '@retemper/types';
import { resolvePlugins, importPlugin } from './resolver';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** Creates a temporary directory with a mock plugin installed in node_modules */
async function createFixtureWithPlugin(
  pluginName: string,
  pluginCode: string,
  packageJsonOverrides: Record<string, unknown> = {},
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
  const pluginDir = join(rootDir, 'node_modules', pluginName);
  await mkdir(pluginDir, { recursive: true });

  const packageJson = {
    name: pluginName,
    version: '1.0.0',
    type: 'module',
    exports: { '.': './index.mjs' },
    ...packageJsonOverrides,
  };

  await writeFile(join(pluginDir, 'package.json'), JSON.stringify(packageJson));
  await writeFile(join(pluginDir, 'index.mjs'), pluginCode);

  return {
    rootDir,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

describe('resolvePlugins', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  it('빈 플러그인 배열은 빈 규칙 배열을 반환한다', async () => {
    const rules = await resolvePlugins([]);

    expect(rules).toStrictEqual([]);
  });

  it('플러그인 모듈을 로드하고 규칙을 수집한다', async () => {
    const pluginCode = `
      export default {
        name: 'test-plugin',
        rules: [
          { name: 'test-plugin/no-foo', description: 'No foo', needs: [], check() {} },
          { name: 'test-plugin/no-bar', description: 'No bar', needs: [], check() {} },
        ],
      };
    `;
    const fixture = await createFixtureWithPlugin('test-plugin', pluginCode);
    fixtures.push(fixture);

    const rules = await resolvePlugins(
      [{ name: 'test-plugin', plugin: { name: 'test-plugin', rules: [] }, options: {} }],
      fixture.rootDir,
    );

    expect(rules).toHaveLength(2);
    expect(rules[0].pluginName).toBe('test-plugin');
    expect(rules[0].rule.name).toBe('test-plugin/no-foo');
    expect(rules[1].rule.name).toBe('test-plugin/no-bar');
  });

  it('팩토리 함수 플러그인에 옵션을 전달한다', async () => {
    const pluginCode = `
      export default function createPlugin(opts) {
        return {
          name: 'factory-plugin',
          rules: [
            { name: 'factory-plugin/check', description: 'Check with ' + opts.mode, needs: [], check() {} },
          ],
        };
      };
    `;
    const fixture = await createFixtureWithPlugin('factory-plugin', pluginCode);
    fixtures.push(fixture);

    const rules = await resolvePlugins(
      [
        {
          name: 'factory-plugin',
          plugin: { name: 'factory-plugin', rules: [] },
          options: { mode: 'strict' },
        },
      ],
      fixture.rootDir,
    );

    expect(rules).toHaveLength(1);
    expect(rules[0].pluginName).toBe('factory-plugin');
  });

  it('플러그인을 찾을 수 없으면 에러를 throw한다', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    await expect(
      resolvePlugins(
        [
          {
            name: 'nonexistent-plugin',
            plugin: { name: 'nonexistent-plugin', rules: [] },
            options: {},
          },
        ],
        rootDir,
      ),
    ).rejects.toThrow('Failed to resolve plugin: nonexistent-plugin');
  });

  it('여러 플러그인의 규칙을 합친다', async () => {
    const pluginACode = `
      export default {
        name: 'plugin-a',
        rules: [{ name: 'plugin-a/rule1', description: 'Rule 1', needs: [], check() {} }],
      };
    `;
    const pluginBCode = `
      export default {
        name: 'plugin-b',
        rules: [{ name: 'plugin-b/rule1', description: 'Rule 1', needs: [], check() {} }],
      };
    `;

    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    const pluginADir = join(rootDir, 'node_modules', 'plugin-a');
    const pluginBDir = join(rootDir, 'node_modules', 'plugin-b');
    await mkdir(pluginADir, { recursive: true });
    await mkdir(pluginBDir, { recursive: true });

    await writeFile(
      join(pluginADir, 'package.json'),
      JSON.stringify({
        name: 'plugin-a',
        type: 'module',
        exports: { '.': './index.mjs' },
      }),
    );
    await writeFile(join(pluginADir, 'index.mjs'), pluginACode);

    await writeFile(
      join(pluginBDir, 'package.json'),
      JSON.stringify({
        name: 'plugin-b',
        type: 'module',
        exports: { '.': './index.mjs' },
      }),
    );
    await writeFile(join(pluginBDir, 'index.mjs'), pluginBCode);

    const rules = await resolvePlugins(
      [
        { name: 'plugin-a', plugin: { name: 'plugin-a', rules: [] }, options: {} },
        { name: 'plugin-b', plugin: { name: 'plugin-b', rules: [] }, options: {} },
      ],
      rootDir,
    );

    expect(rules).toHaveLength(2);
    expect(rules[0].pluginName).toBe('plugin-a');
    expect(rules[1].pluginName).toBe('plugin-b');
  });

  it('rules가 이미 로드된 플러그인은 module import 없이 직접 사용한다', async () => {
    const rule = {
      name: 'inline/rule',
      description: 'A rule',
      needs: [] as readonly ProviderKey[],
      check: async () => {},
    };
    const plugin = { name: 'inline-plugin', rules: [rule] as readonly (typeof rule)[] };

    const rules = await resolvePlugins([
      { name: 'inline-plugin', plugin, options: {} as Readonly<Record<string, unknown>> },
    ]);

    expect(rules).toHaveLength(1);
    expect(rules[0].rule.name).toBe('inline/rule');
    expect(rules[0].pluginName).toBe('inline-plugin');
  });
});

describe('importPlugin', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  it('node_modules에서 플러그인을 해석한다', async () => {
    const pluginCode = `
      export default {
        name: 'my-plugin',
        rules: [],
      };
    `;
    const fixture = await createFixtureWithPlugin('my-plugin', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('my-plugin', fixture.rootDir);

    expect(plugin).not.toBeNull();
    expect(typeof plugin === 'object' && plugin !== null && 'name' in plugin).toBe(true);
  });

  it('존재하지 않는 플러그인은 null을 반환한다', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    const plugin = await importPlugin('does-not-exist', rootDir);

    expect(plugin).toBeNull();
  });

  it('main 필드로 entry point를 해석한다', async () => {
    const pluginCode = `
      export default { name: 'main-plugin', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('main-plugin', pluginCode, {
      exports: undefined,
      main: './index.mjs',
    });
    fixtures.push(fixture);

    const plugin = await importPlugin('main-plugin', fixture.rootDir);

    expect(plugin).not.toBeNull();
  });

  it('exports 필드의 문자열 형식을 해석한다', async () => {
    const pluginCode = `
      export default { name: 'str-exports', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('str-exports', pluginCode, {
      exports: { '.': './index.mjs' },
    });
    fixtures.push(fixture);

    const plugin = await importPlugin('str-exports', fixture.rootDir);

    expect(plugin).not.toBeNull();
  });

  it('named export에서 플러그인을 추출한다', async () => {
    const pluginCode = `
      export const myPlugin = { name: 'named-export-plugin', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('named-export-plugin', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('named-export-plugin', fixture.rootDir);

    expect(plugin).not.toBeNull();
  });

  it('named export에서 팩토리 함수를 추출한다', async () => {
    const pluginCode = `
      export function createPlugin() {
        return { name: 'factory-named', rules: [] };
      }
    `;
    const fixture = await createFixtureWithPlugin('factory-named', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('factory-named', fixture.rootDir);

    expect(plugin).not.toBeNull();
    expect(typeof plugin).toBe('function');
  });

  it('async 팩토리 함수 플러그인을 해석한다', async () => {
    const pluginCode = `
      export default async function createPlugin(opts) {
        return {
          name: 'async-factory',
          rules: [
            { name: 'async-factory/rule', description: 'Async rule', needs: [], check() {} },
          ],
        };
      };
    `;
    const fixture = await createFixtureWithPlugin('async-factory', pluginCode);
    fixtures.push(fixture);

    const rules = await resolvePlugins(
      [
        {
          name: 'async-factory',
          plugin: { name: 'async-factory', rules: [] },
          options: {},
        },
      ],
      fixture.rootDir,
    );

    expect(rules).toHaveLength(1);
    expect(rules[0].pluginName).toBe('async-factory');
  });

  it('NODE_PATH가 빈 문자열이면 무시한다', async () => {
    const originalNodePath = process.env['NODE_PATH'];
    process.env['NODE_PATH'] = '';

    try {
      const plugin = await importPlugin('nonexistent-for-empty-node-path');
      expect(plugin).toBeNull();
    } finally {
      if (originalNodePath === undefined) {
        delete process.env['NODE_PATH'];
      } else {
        process.env['NODE_PATH'] = originalNodePath;
      }
    }
  });

  it('NODE_PATH 환경변수에서 빈 항목은 무시한다', async () => {
    const pluginCode = `
      export default { name: 'nodepath-plugin', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('nodepath-plugin', pluginCode);
    fixtures.push(fixture);

    const originalNodePath = process.env['NODE_PATH'];
    const nodeModulesDir = join(fixture.rootDir, 'node_modules');
    process.env['NODE_PATH'] = `:${nodeModulesDir}: :`;

    try {
      await importPlugin('nodepath-plugin', undefined);
    } finally {
      if (originalNodePath === undefined) {
        delete process.env['NODE_PATH'];
      } else {
        process.env['NODE_PATH'] = originalNodePath;
      }
    }
  });

  it('exports 필드가 없고 main 필드도 없으면 index.js로 fallback한다', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    const pluginDir = join(rootDir, 'node_modules', 'no-entry');
    await mkdir(pluginDir, { recursive: true });

    await writeFile(
      join(pluginDir, 'package.json'),
      JSON.stringify({ name: 'no-entry', type: 'module' }),
    );
    await writeFile(join(pluginDir, 'index.js'), `export default { name: 'no-entry', rules: [] };`);

    const plugin = await importPlugin('no-entry', rootDir);

    expect(plugin).not.toBeNull();
  });

  it('플러그인처럼 보이지 않는 모듈은 null을 반환한다', async () => {
    const pluginCode = `
      export const version = '1.0.0';
      export const config = { debug: true };
    `;
    const fixture = await createFixtureWithPlugin('non-plugin', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('non-plugin', fixture.rootDir);

    expect(plugin).toBeNull();
  });

  it('exports의 import 필드가 null이면 main 필드로 fallback한다', async () => {
    const pluginCode = `
      export default { name: 'null-import', rules: [] };
    `;
    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    const pluginDir = join(rootDir, 'node_modules', 'null-import');
    await mkdir(pluginDir, { recursive: true });

    // JSON.stringify preserves null (unlike undefined)
    await writeFile(
      join(pluginDir, 'package.json'),
      JSON.stringify({
        name: 'null-import',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { import: null } },
        main: './index.mjs',
      }),
    );
    await writeFile(join(pluginDir, 'index.mjs'), pluginCode);

    const plugin = await importPlugin('null-import', rootDir);

    expect(plugin).not.toBeNull();
  });

  it('exports에 import 필드가 없는 object는 main으로 fallback한다', async () => {
    const pluginCode = `
      export default { name: 'no-import-field', rules: [] };
    `;
    const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-resolver-test-'));
    fixtures.push({
      rootDir,
      async cleanup() {
        await rm(rootDir, { recursive: true, force: true });
      },
    });

    const pluginDir = join(rootDir, 'node_modules', 'no-import-field');
    await mkdir(pluginDir, { recursive: true });

    await writeFile(
      join(pluginDir, 'package.json'),
      JSON.stringify({
        name: 'no-import-field',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { require: './index.cjs' } },
        main: './index.mjs',
      }),
    );
    await writeFile(join(pluginDir, 'index.mjs'), pluginCode);

    const plugin = await importPlugin('no-import-field', rootDir);

    expect(plugin).not.toBeNull();
  });

  it('exports가 plain string인 package.json을 해석한다', async () => {
    const pluginCode = `
      export default { name: 'plain-str', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('plain-str', pluginCode, {
      exports: { '.': './index.mjs' },
    });
    fixtures.push(fixture);

    const plugin = await importPlugin('plain-str', fixture.rootDir);

    expect(plugin).not.toBeNull();
  });
});
