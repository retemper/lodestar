import { dirname, resolve } from 'node:path';
import { loadConfigFile } from '@retemper/lodestar-config';
import type { ToolAdapter, WrittenConfig, WrittenConfigBlock } from '@retemper/lodestar-types';

/** Extract the eslint adapter from a loaded config, if present */
function findEslintAdapter(config: WrittenConfig): ToolAdapter | undefined {
  const blocks: readonly WrittenConfigBlock[] = Array.isArray(config) ? config : [config];
  return blocks.flatMap((b) => b.adapters ?? []).find((a) => a.name === 'eslint');
}

/**
 * Walk up from dir loading lodestar configs until one with an eslint adapter is found.
 * Sub-package configs may omit adapters — the root config provides them.
 */
async function loadConfigWithEslintAdapter(
  dir: string,
): Promise<{ readonly config: WrittenConfig; readonly adapter: ToolAdapter }> {
  const config = await loadConfigFile(dir);
  if (config) {
    const adapter = findEslintAdapter(config);
    if (adapter) return { config, adapter };
  }

  const parent = dirname(dir);
  if (parent === dir) {
    throw new Error(
      'No lodestar.config.ts with eslintAdapter() found. Add eslintAdapter() to the adapters array.',
    );
  }

  return loadConfigWithEslintAdapter(parent);
}

let deprecationWarned = false;

/**
 * Generate ESLint flat config from lodestar.config.ts.
 *
 * @deprecated Use static code generation via `generateConfigFile()` instead.
 * This function will be removed in a future major version.
 * Run `lodestar check --fix` to generate a static eslint.config.js.
 *
 * @param configDir - directory to search for lodestar.config.ts (default: cwd)
 */
async function fromLodestar(configDir?: string): Promise<unknown[]> {
  if (!deprecationWarned) {
    deprecationWarned = true;
    console.warn(
      '[lodestar] fromLodestar() is deprecated. Run `lodestar check --fix` to generate a static eslint.config.js.',
    );
  }

  const startDir = configDir ? resolve(configDir) : process.cwd();
  const { adapter } = await loadConfigWithEslintAdapter(startDir);

  if (!adapter.generateConfig) {
    throw new Error('ESLint adapter missing generateConfig().');
  }
  return adapter.generateConfig();
}

export { fromLodestar };
