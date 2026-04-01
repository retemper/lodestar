import type { Severity } from './rule.js';

/** User-written config shape — optional fields, shorthand allowed */
interface WrittenConfig {
  readonly extends?: string | readonly string[];
  readonly plugins?: readonly PluginEntry[];
  readonly rules?: Readonly<Record<string, Severity | WrittenRuleConfig>>;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly baseline?: string | boolean;
}

/** Plugin reference: string (package name) or [name, options] tuple */
type PluginEntry = string | readonly [string, Readonly<Record<string, unknown>>];

/** Detailed rule config with options */
interface WrittenRuleConfig {
  readonly severity: Severity;
  readonly options?: Readonly<Record<string, unknown>>;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
}

/** Fully resolved, normalized config — all fields required */
interface ResolvedConfig {
  readonly rootDir: string;
  readonly plugins: readonly ResolvedPlugin[];
  readonly rules: ReadonlyMap<string, ResolvedRuleConfig>;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly baseline: string | null;
}

/** Resolved plugin after module loading */
interface ResolvedPlugin {
  readonly name: string;
  readonly options: Readonly<Record<string, unknown>>;
}

/** Resolved rule config */
interface ResolvedRuleConfig {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly options: Readonly<Record<string, unknown>>;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

/** Helper to define config with type inference */
function defineConfig(config: WrittenConfig): WrittenConfig {
  return config;
}

export { defineConfig };
export type {
  WrittenConfig,
  PluginEntry,
  WrittenRuleConfig,
  ResolvedConfig,
  ResolvedPlugin,
  ResolvedRuleConfig,
};
