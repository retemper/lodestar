import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { WrittenConfig } from 'lodestar';

/** Absolute path to the monorepo packages directory */
const PACKAGES_DIR = resolve(import.meta.dirname, '../../../../../packages');

/** Absolute path to the monorepo plugins directory */
const PLUGINS_DIR = resolve(import.meta.dirname, '../../../../../plugins');

/** Result of creating a test fixture directory */
interface FixtureResult {
  /** Absolute path to the created temporary directory */
  readonly rootDir: string;
  /** Cleans up the temporary directory */
  cleanup(): Promise<void>;
}

/**
 * Creates a temporary directory based on a file structure map.
 * @param structure - A map of relative paths to file contents. A null value creates an empty directory.
 */
async function createFixtureDir(
  structure: Readonly<Record<string, string | null>>,
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-test-'));

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

/**
 * Creates lodestar.config.mjs in the fixture directory and symlinks referenced plugins into node_modules.
 * Uses .mjs instead of .ts so Node can dynamically import it directly.
 * @param rootDir - Absolute path to the fixture directory
 * @param config - Lodestar configuration to serialize into the fixture
 */
async function createFixtureConfig(rootDir: string, config: WrittenConfig): Promise<void> {
  const configContent = `export default ${JSON.stringify(config, null, 2)};\n`;
  await writeFile(join(rootDir, 'lodestar.config.mjs'), configContent, 'utf-8');

  // Symlink @lodestar/* plugins specified in the config into the fixture's node_modules
  const blocks = Array.isArray(config) ? config : [config];
  const plugins = blocks.flatMap((block) => block.plugins ?? []);
  for (const entry of plugins) {
    const name = typeof entry === 'string' ? entry : (entry as readonly [string, ...unknown[]])[0];
    if (name.startsWith('@lodestar/')) {
      await symlinkWorkspacePackage(rootDir, name);
    }
  }
}

/**
 * Creates a symlink from @lodestar/* to the correct monorepo directory.
 * @param rootDir - Absolute path to the fixture directory
 * @param packageName - Scoped package name (e.g. '@lodestar/plugin-structure')
 */
async function symlinkWorkspacePackage(rootDir: string, packageName: string): Promise<void> {
  const shortName = packageName.replace('@lodestar/', '');
  const sourcePath = shortName.startsWith('plugin-')
    ? join(PLUGINS_DIR, shortName.replace('plugin-', ''))
    : join(PACKAGES_DIR, shortName);
  const targetDir = join(rootDir, 'node_modules', '@lodestar');
  const targetPath = join(targetDir, shortName);

  await mkdir(targetDir, { recursive: true });
  await symlink(sourcePath, targetPath, 'dir');
}

export { createFixtureDir, createFixtureConfig };
export type { FixtureResult };
