import { dirname, resolve } from 'node:path';
import { loadConfigFile } from '@lodestar/config';
import type { ToolAdapter, WrittenConfig, WrittenConfigBlock } from '@lodestar/types';

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

/**
 * Generate ESLint flat config from lodestar.config.ts.
 * Used in eslint.config.js for IDE integration:
 *
 * ```js
 * import { fromLodestar } from '@lodestar/adapter-eslint';
 * export default await fromLodestar();
 * ```
 *
 * @param configDir - directory to search for lodestar.config.ts (default: cwd)
 */
async function fromLodestar(configDir?: string): Promise<unknown[]> {
  const startDir = configDir ? resolve(configDir) : process.cwd();
  const { adapter } = await loadConfigWithEslintAdapter(startDir);

  if (!adapter.generateConfig) {
    throw new Error('ESLint adapter missing generateConfig().');
  }
  return adapter.generateConfig();
}

export { fromLodestar };
