import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin, RuleDefinition, ResolvedPlugin } from '@retemper/lodestar-types';

/** Resolved rule with its plugin namespace */
interface ResolvedRule {
  /** Name of the plugin that registered this rule */
  readonly pluginName: string;
  /** The rule definition including name and check function */
  readonly rule: RuleDefinition;
}

/**
 * Resolve plugin modules and collect all rules.
 * @param plugins - pre-resolved plugin references from config
 * @param rootDir - base directory for node_modules resolution fallback
 */
async function resolvePlugins(
  plugins: readonly ResolvedPlugin[],
  rootDir?: string,
): Promise<readonly ResolvedRule[]> {
  const rules: ResolvedRule[] = [];

  for (const pluginRef of plugins) {
    // If plugin was resolved at config time (direct import), use it directly
    const plugin =
      pluginRef.plugin.rules.length > 0
        ? pluginRef.plugin
        : await importPluginByName(pluginRef.name, rootDir);

    if (!plugin) {
      throw new Error(`Failed to resolve plugin: ${pluginRef.name}`);
    }

    const maybeAsync = typeof plugin === 'function' ? plugin(pluginRef.options) : plugin;
    const resolved = maybeAsync instanceof Promise ? await maybeAsync : maybeAsync;

    for (const rule of resolved.rules) {
      rules.push({ pluginName: resolved.name, rule });
    }
  }

  return rules;
}

/**
 * Import a plugin module by name (legacy string-based resolution).
 * @param name - npm package name or scoped package identifier
 * @param rootDir - base directory to start node_modules resolution from
 */
async function importPluginByName(
  name: string,
  rootDir?: string,
): Promise<Plugin | ((opts: unknown) => Plugin) | null> {
  const dirs = buildSearchDirs(rootDir);

  for (const dir of dirs) {
    try {
      const resolved = await resolveFromDir(name, dir);
      const mod = await import(resolved);
      const plugin = extractPlugin(mod);
      if (plugin) return plugin;
    } catch {
      // Failed to resolve from this directory — try next
    }
  }

  // All directories exhausted — fall back to bare import
  try {
    const mod = await import(name);
    return extractPlugin(mod) ?? null;
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
      if (trimmed) dirs.push(join(trimmed, '..'));
    }
  }

  return dirs;
}

/**
 * Resolve the ESM entry point of a package from the given directory's node_modules.
 * @param name - package name to look up
 * @param dir - parent directory containing node_modules
 */
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

/** A value that is either a Plugin instance or a factory that produces one */
type PluginLike = Plugin | ((opts: unknown) => Plugin);

/** Extract a plugin from a module's exports — supports named and default exports */
function extractPlugin(mod: Record<string, unknown>): PluginLike | null {
  // Try default export first (backwards compat)
  if (mod.default && isPluginLike(mod.default)) return mod.default as PluginLike;

  // Try named exports — find the first one that looks like a plugin/factory
  for (const value of Object.values(mod)) {
    if (isPluginLike(value)) return value as PluginLike;
  }

  return null;
}

/** Check if a value looks like a Plugin or PluginFactory */
function isPluginLike(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (typeof value === 'object' && value !== null && 'name' in value && 'rules' in value)
    return true;
  return false;
}

export { resolvePlugins, importPluginByName as importPlugin };
export type { ResolvedRule };
