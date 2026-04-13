import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ProviderKey } from '@retemper/lodestar-types';
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

  it('returns empty rules array for empty plugin array', async () => {
    const rules = await resolvePlugins([]);

    expect(rules).toStrictEqual([]);
  });

  it('loads plugin module and collects rules', async () => {
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

  it('passes options to factory function plugin', async () => {
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

  it('throws error when plugin is not found', async () => {
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

  it('merges rules from multiple plugins', async () => {
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

  it('uses already-loaded plugins directly without module import', async () => {
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

  it('resolves plugin from node_modules', async () => {
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

  it('returns null for non-existent plugin', async () => {
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

  it('resolves entry point via main field', async () => {
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

  it('resolves string format of exports field', async () => {
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

  it('extracts plugin from named export', async () => {
    const pluginCode = `
      export const myPlugin = { name: 'named-export-plugin', rules: [] };
    `;
    const fixture = await createFixtureWithPlugin('named-export-plugin', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('named-export-plugin', fixture.rootDir);

    expect(plugin).not.toBeNull();
  });

  it('extracts factory function from named export', async () => {
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

  it('resolves async factory function plugin', async () => {
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

  it('ignores NODE_PATH when it is an empty string', async () => {
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

  it('ignores empty entries in NODE_PATH environment variable', async () => {
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

  it('falls back to index.js when neither exports nor main field exists', async () => {
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

  it('returns null for module that does not look like a plugin', async () => {
    const pluginCode = `
      export const version = '1.0.0';
      export const config = { debug: true };
    `;
    const fixture = await createFixtureWithPlugin('non-plugin', pluginCode);
    fixtures.push(fixture);

    const plugin = await importPlugin('non-plugin', fixture.rootDir);

    expect(plugin).toBeNull();
  });

  it('falls back to main when exports import field is null', async () => {
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

  it('falls back to main for exports object without import field', async () => {
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

  it('resolves package.json with plain string exports', async () => {
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
