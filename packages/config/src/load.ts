import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
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

/** Load lodestar config from the given directory */
async function loadConfigFile(rootDir: string): Promise<WrittenConfig | null> {
  const resolvedRoot = resolve(rootDir);

  for (const filename of CONFIG_FILES) {
    const configPath = join(resolvedRoot, filename);
    if (await fileExists(configPath)) {
      const configUrl = pathToFileURL(configPath).href;
      const mod: unknown = await import(configUrl);
      if (isConfigModule(mod)) return mod.default;
      return null;
    }
  }

  return null;
}

export { loadConfigFile, CONFIG_FILES };
