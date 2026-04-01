import type { WrittenConfig, Severity, WrittenRuleConfig } from '@lodestar/types';

/** Merge a base config (from preset/extends) with user overrides */
function mergeConfigs(base: WrittenConfig, override: WrittenConfig): WrittenConfig {
  const mergedPlugins = [...(base.plugins ?? [])];

  if (override.plugins) {
    for (const plugin of override.plugins) {
      const name = typeof plugin === 'string' ? plugin : plugin[0];
      const existingIndex = mergedPlugins.findIndex(
        (p) => (typeof p === 'string' ? p : p[0]) === name,
      );
      if (existingIndex >= 0) {
        mergedPlugins[existingIndex] = plugin;
      } else {
        mergedPlugins.push(plugin);
      }
    }
  }

  const mergedRules: Record<string, Severity | WrittenRuleConfig> = {
    ...base.rules,
    ...override.rules,
  };

  return {
    plugins: mergedPlugins,
    rules: mergedRules,
    include: override.include ?? base.include,
    exclude: override.exclude ?? base.exclude,
    baseline: override.baseline ?? base.baseline,
  };
}

export { mergeConfigs };
