import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin, RuleDefinition, ResolvedPlugin } from '@lodestar/types';

/** Resolved rule with its plugin namespace */
interface ResolvedRule {
  readonly pluginName: string;
  readonly rule: RuleDefinition;
}

/** Resolve plugin modules and collect all rules */
async function resolvePlugins(
  plugins: readonly ResolvedPlugin[],
  rootDir?: string,
): Promise<readonly ResolvedRule[]> {
  const rules: ResolvedRule[] = [];

  for (const pluginRef of plugins) {
    const pluginModule = await importPlugin(pluginRef.name, rootDir);

    if (!pluginModule) {
      throw new Error(`Failed to resolve plugin: ${pluginRef.name}`);
    }

    const plugin =
      typeof pluginModule === 'function' ? pluginModule(pluginRef.options) : pluginModule;

    for (const rule of plugin.rules) {
      rules.push({
        pluginName: plugin.name,
        rule,
      });
    }
  }

  return rules;
}

/** Import a plugin module by name or path */
async function importPlugin(
  name: string,
  rootDir?: string,
): Promise<Plugin | ((opts: unknown) => Plugin) | null> {
  const dirs = buildSearchDirs(rootDir);

  for (const dir of dirs) {
    try {
      const resolved = await resolveFromDir(name, dir);
      const mod = (await import(resolved)) as { default?: Plugin | ((opts: unknown) => Plugin) };
      if (mod.default) return mod.default;
    } catch {
      // Failed to resolve from this directory — try next
    }
  }

  // All directories exhausted — fall back to bare import
  try {
    const mod = (await import(name)) as { default?: Plugin | ((opts: unknown) => Plugin) };
    return mod.default ?? null;
  } catch {
    return null;
  }
}

/** Build a list of plugin search directories from rootDir and NODE_PATH */
function buildSearchDirs(rootDir?: string): readonly string[] {
  const dirs: string[] = [];
  if (rootDir) dirs.push(rootDir);

  const nodePath = process.env['NODE_PATH'];
  if (nodePath) {
    for (const p of nodePath.split(':')) {
      const trimmed = p.trim();
      // NODE_PATH points to node_modules, so use the parent directory
      if (trimmed) dirs.push(join(trimmed, '..'));
    }
  }

  return dirs;
}

/** Resolve the ESM entry point of a package from the given directory's node_modules */
async function resolveFromDir(name: string, dir: string): Promise<string> {
  const packageDir = join(dir, 'node_modules', name);
  const packageJsonPath = join(packageDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(raw) as {
    exports?: Record<string, { import?: string } | string>;
    main?: string;
  };

  const entryPoint = resolveExportsEntry(pkg) ?? pkg.main ?? 'index.js';
  return pathToFileURL(join(packageDir, entryPoint)).href;
}

/** Extract the import path for the "." entry point from package.json exports */
function resolveExportsEntry(pkg: {
  exports?: Record<string, { import?: string } | string>;
}): string | null {
  if (!pkg.exports) return null;
  const dot = pkg.exports['.'];
  if (typeof dot === 'string') return dot;
  if (dot && typeof dot === 'object' && 'import' in dot) return dot.import ?? null;
  return null;
}

export { resolvePlugins, importPlugin };
export type { ResolvedRule };
