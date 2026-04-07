import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WrittenConfig } from '@lodestar/types';

/** Supported config file names in priority order */
const CONFIG_FILES = ['lodestar.config.ts', 'lodestar.config.js', 'lodestar.config.mjs'] as const;

/** Check if a file exists asynchronously */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Check if a value is a valid config module with a default export */
function isConfigModule(mod: unknown): mod is { default: WrittenConfig } {
  return typeof mod === 'object' && mod !== null && 'default' in mod;
}

/**
 * Load lodestar config from the given directory.
 * Uses jiti for TypeScript config files. No cascading — loads exactly one file.
 * @param rootDir - absolute path to search for config files
 */
async function loadConfigFile(rootDir: string): Promise<WrittenConfig | null> {
  const resolvedRoot = resolve(rootDir);

  for (const filename of CONFIG_FILES) {
    const configPath = join(resolvedRoot, filename);
    if (await fileExists(configPath)) {
      const mod = await importConfig(configPath);
      if (!isConfigModule(mod)) return null;
      return mod.default;
    }
  }

  return null;
}

/**
 * Import a config file using jiti for TypeScript support.
 * @param configPath - absolute path to the config file
 */
async function importConfig(configPath: string): Promise<unknown> {
  if (configPath.endsWith('.ts')) {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(configPath, { interopDefault: true });
    return jiti.import(configPath);
  }
  return import(pathToFileURL(configPath).href);
}

export { loadConfigFile, CONFIG_FILES };
