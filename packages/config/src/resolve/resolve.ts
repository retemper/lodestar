import type {
  WrittenConfig,
  ResolvedConfig,
  ResolvedPlugin,
  ResolvedRuleConfig,
  ScopedRuleConfig,
  Severity,
  WrittenRuleConfig,
  PluginEntry,
  Plugin,
  ToolAdapter,
  WorkspaceReporter,
  ReporterEntry,
} from '@retemper/lodestar-types';

/**
 * Normalize a flat config (single block or array) into a fully resolved config.
 * @param written - user-authored config to normalize
 * @param rootDir - absolute path used as the resolution base
 */
function resolveConfig(written: WrittenConfig, rootDir: string): ResolvedConfig {
  const blocks = Array.isArray(written) ? [...written] : [written];

  const allPlugins: ResolvedPlugin[] = [];
  const pluginIds = new Set<string>();
  const globalRules = new Map<string, ResolvedRuleConfig>();
  const scopedRules: ScopedRuleConfig[] = [];
  const adapterMap = new Map<string, ToolAdapter>();
  const reporters: WorkspaceReporter[] = [];

  for (const block of blocks) {
    // Collect plugins (deduplicate by ID)
    for (const entry of block.plugins ?? []) {
      const resolved = resolvePluginEntry(entry);
      if (!pluginIds.has(resolved.name)) {
        pluginIds.add(resolved.name);
        allPlugins.push(resolved);
      }
    }

    // Collect adapters (deduplicate by name, last wins)
    for (const adapter of block.adapters ?? []) {
      adapterMap.set(adapter.name, adapter);
    }

    // Collect reporters from config
    for (const entry of block.reporters ?? []) {
      const resolved = resolveReporterEntry(entry);
      if (resolved) reporters.push(resolved);
    }

    // Collect rules — global or scoped
    if (block.rules && Object.keys(block.rules).length > 0) {
      const resolvedRules = new Map<string, ResolvedRuleConfig>();
      for (const [ruleId, ruleConfig] of Object.entries(block.rules)) {
        resolvedRules.set(
          ruleId,
          normalizeRuleConfig(ruleId, ruleConfig as Severity | WrittenRuleConfig),
        );
      }

      if (block.files) {
        scopedRules.push({
          files: [...block.files],
          ignores: [...(block.ignores ?? [])],
          rules: resolvedRules,
        });
      } else {
        for (const [ruleId, config] of resolvedRules) {
          globalRules.set(ruleId, config);
        }
      }
    }
  }

  return {
    rootDir,
    plugins: allPlugins,
    rules: globalRules,
    scopedRules,
    adapters: [...adapterMap.values()],
    baseline: null,
    reporters,
  };
}

/**
 * Resolve a single plugin entry into a ResolvedPlugin.
 * @param entry - plugin entry in any supported format
 */
function resolvePluginEntry(entry: PluginEntry): ResolvedPlugin {
  if (typeof entry === 'string') {
    return { name: entry, plugin: { name: entry, rules: [] }, options: {} };
  }

  if (Array.isArray(entry)) {
    const [pluginOrName, options] = entry;
    if (typeof pluginOrName === 'string') {
      return {
        name: pluginOrName,
        plugin: { name: pluginOrName, rules: [] },
        options: { ...options },
      };
    }
    const plugin = pluginOrName();
    return { name: plugin.name, plugin: plugin as Plugin, options: { ...options } };
  }

  if (typeof entry === 'function') {
    const result = entry();
    const plugin = result as Plugin;
    return { name: plugin.name, plugin, options: {} };
  }

  const plugin = entry as Plugin;
  return { name: plugin.name, plugin, options: {} };
}

/**
 * Normalize a rule config from shorthand or full form.
 * @param ruleId - the rule identifier
 * @param config - severity string or full WrittenRuleConfig
 */
function normalizeRuleConfig(
  ruleId: string,
  config: Severity | WrittenRuleConfig,
): ResolvedRuleConfig {
  if (typeof config === 'string') {
    return { ruleId, severity: config, options: {} };
  }
  return {
    ruleId,
    severity: config.severity,
    options: config.options ? { ...config.options } : {},
  };
}

/**
 * Resolve a reporter entry into a WorkspaceReporter instance.
 * String entries (built-in names) return null — CLI handles those by name.
 * @param entry - reporter reference from config
 */
function resolveReporterEntry(entry: ReporterEntry): WorkspaceReporter | null {
  if (typeof entry === 'string') {
    return null;
  }

  if ('create' in entry) {
    return entry.create();
  }

  const [factory, options] = entry;
  return factory.create(options);
}

export { resolveConfig, resolvePluginEntry, normalizeRuleConfig, resolveReporterEntry };
