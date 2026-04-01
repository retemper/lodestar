import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureDir, createFixtureConfig } from '../helpers/fixture.js';
import type { FixtureResult } from '../helpers/fixture.js';
import { loadConfigFile } from '@lodestar/config';
import { resolveConfig, mergeConfigs } from '@lodestar/config';

describe('Config pipeline integration test', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  /** Helper that creates a fixture and registers it for cleanup */
  async function setup(structure: Record<string, string | null> = {}) {
    const fixture = await createFixtureDir(structure);
    fixtures.push(fixture);
    return fixture;
  }

  describe('loadConfigFile', () => {
    it('loads a .mjs config file', async () => {
      const { rootDir } = await setup({});
      await createFixtureConfig(rootDir, {
        plugins: ['@lodestar/plugin-structure'],
        rules: { 'structure/directory-exists': 'error' },
      });

      const config = await loadConfigFile(rootDir);

      expect(config).not.toBeNull();
      expect(config?.plugins).toStrictEqual(['@lodestar/plugin-structure']);
      expect(config?.rules?.['structure/directory-exists']).toBe('error');
    });

    it('loads a .js config file', async () => {
      const { rootDir } = await setup({
        'lodestar.config.js': `export default { rules: { 'test-rule': 'warn' } };\n`,
      });

      const config = await loadConfigFile(rootDir);

      expect(config).not.toBeNull();
      expect(config?.rules?.['test-rule']).toBe('warn');
    });

    it('returns null when no config file exists', async () => {
      const { rootDir } = await setup({});

      const config = await loadConfigFile(rootDir);

      expect(config).toBeNull();
    });

    it('can define both plugins and rules in a config', async () => {
      const { rootDir } = await setup({});
      await createFixtureConfig(rootDir, {
        plugins: ['@lodestar/plugin-structure', ['@lodestar/plugin-boundary', { strict: true }]],
        rules: {
          'structure/directory-exists': { severity: 'error', options: { required: ['src'] } },
          'boundary/no-deep-import': 'warn',
        },
        include: ['src/**'],
        baseline: true,
      });

      const config = await loadConfigFile(rootDir);

      expect(config?.plugins).toHaveLength(2);
      expect(config?.rules?.['boundary/no-deep-import']).toBe('warn');
      expect(config?.include).toStrictEqual(['src/**']);
      expect(config?.baseline).toBe(true);
    });
  });

  describe('loadConfigFile → resolveConfig', () => {
    it('normalizes a loaded config into a ResolvedConfig', async () => {
      const { rootDir } = await setup({});
      await createFixtureConfig(rootDir, {
        plugins: ['@lodestar/plugin-structure'],
        rules: { 'structure/directory-exists': 'error' },
        baseline: true,
      });

      const written = await loadConfigFile(rootDir);
      expect(written).not.toBeNull();

      const resolved = resolveConfig(written!, rootDir);

      expect(resolved.rootDir).toBe(rootDir);
      expect(resolved.plugins).toStrictEqual([{ name: '@lodestar/plugin-structure', options: {} }]);
      expect(resolved.rules.get('structure/directory-exists')).toStrictEqual({
        ruleId: 'structure/directory-exists',
        severity: 'error',
        options: {},
        include: [],
        exclude: [],
      });
      expect(resolved.baseline).toBe('.lodestar-baseline.json');
    });

    it('resolves with defaults even for a directory without a config', async () => {
      const { rootDir } = await setup({});

      const resolved = resolveConfig({}, rootDir);

      expect(resolved.rootDir).toBe(rootDir);
      expect(resolved.plugins).toStrictEqual([]);
      expect(resolved.rules.size).toBe(0);
      expect(resolved.include).toStrictEqual(['**/*']);
      expect(resolved.exclude).toStrictEqual(['node_modules/**', 'dist/**']);
    });
  });

  describe('mergeConfigs → resolveConfig', () => {
    it('merges base config with overrides and then resolves', async () => {
      const { rootDir } = await setup({});

      const base = {
        plugins: ['@lodestar/plugin-structure'] as const,
        rules: { 'structure/directory-exists': 'error' as const },
      };
      const override = {
        rules: {
          'structure/directory-exists': 'warn' as const,
          'structure/file-naming': 'error' as const,
        },
      };

      const merged = mergeConfigs(base, override);
      const resolved = resolveConfig(merged, rootDir);

      expect(resolved.rules.get('structure/directory-exists')?.severity).toBe('warn');
      expect(resolved.rules.get('structure/file-naming')?.severity).toBe('error');
      expect(resolved.plugins).toHaveLength(1);
    });
  });
});
