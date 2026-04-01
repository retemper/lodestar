import type {
  WrittenConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  Severity,
  WrittenRuleConfig,
} from '@lodestar/types';

/** Normalize a WrittenConfig into a fully resolved ResolvedConfig */
function resolveConfig(written: WrittenConfig, rootDir: string): ResolvedConfig {
  const rules = new Map<string, ResolvedRuleConfig>();

  if (written.rules) {
    for (const [ruleId, config] of Object.entries(written.rules)) {
      rules.set(ruleId, normalizeRuleConfig(ruleId, config));
    }
  }

  const plugins = (written.plugins ?? []).map((entry) => {
    if (typeof entry === 'string') {
      return { name: entry, options: {} };
    }
    return { name: entry[0], options: entry[1] ?? {} };
  });

  return {
    rootDir,
    plugins,
    rules,
    include: written.include ? [...written.include] : ['**/*'],
    exclude: written.exclude ? [...written.exclude] : ['node_modules/**', 'dist/**'],
    baseline: normalizeBaseline(written.baseline),
  };
}

/** Normalize shorthand severity or full rule config */
function normalizeRuleConfig(
  ruleId: string,
  config: Severity | WrittenRuleConfig,
): ResolvedRuleConfig {
  if (typeof config === 'string') {
    return {
      ruleId,
      severity: config,
      options: {},
      include: [],
      exclude: [],
    };
  }

  return {
    ruleId,
    severity: config.severity,
    options: config.options ?? {},
    include: config.include ? [...config.include] : [],
    exclude: config.exclude ? [...config.exclude] : [],
  };
}

/** Normalize baseline setting */
function normalizeBaseline(baseline: string | boolean | undefined): string | null {
  if (baseline === true) return '.lodestar-baseline.json';
  if (typeof baseline === 'string') return baseline;
  return null;
}

export { resolveConfig, normalizeRuleConfig, normalizeBaseline };
