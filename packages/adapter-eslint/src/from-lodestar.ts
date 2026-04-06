import { resolve } from 'node:path';
import { loadConfigFile } from '@lodestar/config';
import type { WrittenConfigBlock } from '@lodestar/types';

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
  const config = await loadConfigFile(startDir);

  if (!config) {
    throw new Error('No lodestar.config.ts found. Create one with `lodestar init`.');
  }

  const blocks: readonly WrittenConfigBlock[] = Array.isArray(config) ? config : [config];
  const eslintAdapter = blocks.flatMap((b) => b.adapters ?? []).find((a) => a.name === 'eslint');

  if (!eslintAdapter) {
    throw new Error(
      'No eslint adapter in lodestar.config.ts. Add eslintAdapter() to the adapters array.',
    );
  }

  if (!eslintAdapter.generateConfig) {
    throw new Error('ESLint adapter missing generateConfig().');
  }
  return eslintAdapter.generateConfig();
}

export { fromLodestar };
