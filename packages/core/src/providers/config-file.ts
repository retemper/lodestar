import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigFileProvider } from '@retemper/lodestar-types';

/**
 * Create a config file provider for reading project configs.
 * @param rootDir - absolute path; config files are resolved relative to this
 */
function createConfigFileProvider(rootDir: string): ConfigFileProvider {
  return {
    async getPackageJson(dir?: string): Promise<Record<string, unknown>> {
      const target = dir ? join(rootDir, dir) : rootDir;
      const content = await readFile(join(target, 'package.json'), 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    },

    async getTsConfig(dir?: string): Promise<Record<string, unknown>> {
      const target = dir ? join(rootDir, dir) : rootDir;
      const content = await readFile(join(target, 'tsconfig.json'), 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    },

    async getCustomConfig<T = unknown>(filename: string, dir?: string): Promise<T> {
      const target = dir ? join(rootDir, dir) : rootDir;
      const content = await readFile(join(target, filename), 'utf-8');
      return JSON.parse(content) as T;
    },
  };
}

export { createConfigFileProvider };
