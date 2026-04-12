import type { Severity, Violation } from './rule';
import type { Plugin, PluginFactory } from './plugin';
import type { ReporterEntry, WorkspaceReporter } from './reporter';

/** Adapter for external tools — linters, formatters, git hooks, etc. */
interface ToolAdapter<TConfig = unknown> {
  /** Tool identifier (e.g., "eslint", "biome", "prettier", "husky") */
  readonly name: string;
  /** Tool-specific configuration */
  readonly config: TConfig;
  /** Run checks and return violations — for linters and formatters */
  check?(rootDir: string, include: readonly string[]): Promise<readonly Violation[]>;
  /** Auto-fix issues — for linters (--fix) and formatters (--write) */
  fix?(rootDir: string, include: readonly string[]): Promise<void>;
  /** Generate config for IDE/editor integration (e.g., eslint.config.js, .prettierrc) */
  generateConfig?(): Promise<unknown[]>;
  /** Verify that tool setup is correct — returns violations for missing or drifted config files */
  verifySetup?(rootDir: string): Promise<readonly Violation[]>;
  /** Set up tool infrastructure (e.g., git hooks, CI config) — called by lodestar init */
  setup?(rootDir: string): Promise<void>;
}

/** A single config block — the unit of flat config */
interface WrittenConfigBlock {
  /** Glob patterns for files this block applies to — omit for global */
  readonly files?: readonly string[];
  /** Glob patterns for files to exclude from this block */
  readonly ignores?: readonly string[];
  /** Plugins that provide rules */
  readonly plugins?: readonly PluginEntry[];
  /** Rule configurations — severity shorthand or full config */
  readonly rules?: Readonly<Record<string, Severity | WrittenRuleConfig>>;
  /** External tool adapters */
  readonly adapters?: readonly ToolAdapter[];
  /** Reporter configuration — built-in names or ReporterFactory instances */
  readonly reporters?: readonly ReporterEntry[];
}

/**
 * User-written config — a single block or an array of blocks (flat config).
 * Array form enables file-scoped rules via `files` field on each block.
 */
type WrittenConfig = WrittenConfigBlock | readonly WrittenConfigBlock[];

/** Plugin reference: direct import (preferred) or string name (legacy) */
type PluginEntry =
  | PluginFactory
  | Plugin
  | readonly [PluginFactory, Readonly<Record<string, unknown>>]
  | readonly [string, Readonly<Record<string, unknown>>]
  | string;

/** Detailed rule config with options */
interface WrittenRuleConfig {
  /** Enforcement level for this rule */
  readonly severity: Severity;
  /** Rule-specific options, validated against the rule's JSON Schema */
  readonly options?: Readonly<Record<string, unknown>>;
}

/** Scoped rule set — rules that apply to a specific set of files */
interface ScopedRuleConfig {
  /** Glob patterns for files this scope applies to */
  readonly files: readonly string[];
  /** Glob patterns for files to exclude from this scope */
  readonly ignores: readonly string[];
  /** Rules in this scope */
  readonly rules: ReadonlyMap<string, ResolvedRuleConfig>;
}

/** Fully resolved, normalized config */
interface ResolvedConfig {
  /** Absolute path to the project root directory */
  readonly rootDir: string;
  /** All plugins after module loading and deduplication */
  readonly plugins: readonly ResolvedPlugin[];
  /** Rules that apply to all files (from blocks without `files`) */
  readonly rules: ReadonlyMap<string, ResolvedRuleConfig>;
  /** Rules scoped to specific file patterns */
  readonly scopedRules: readonly ScopedRuleConfig[];
  /** All tool adapters (deduplicated by name) */
  readonly adapters: readonly ToolAdapter[];
  /** Absolute path to the baseline snapshot file, or null */
  readonly baseline: string | null;
  /** Resolved reporters from config (empty array means use CLI default) */
  readonly reporters: readonly WorkspaceReporter[];
}

/** Resolved plugin after module loading */
interface ResolvedPlugin {
  /** Plugin display name */
  readonly name: string;
  /** The fully loaded plugin instance containing its rules */
  readonly plugin: Plugin;
  /** Options passed to the plugin factory during initialization */
  readonly options: Readonly<Record<string, unknown>>;
}

/** Resolved rule config */
interface ResolvedRuleConfig {
  /** Fully qualified rule ID */
  readonly ruleId: string;
  /** Enforcement level after merging */
  readonly severity: Severity;
  /** Validated rule-specific options */
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Helper to define config with type inference — accepts single block or flat config array.
 * @param config - a config block or array of blocks
 */
function defineConfig(config: WrittenConfig): WrittenConfig {
  return config;
}

export { defineConfig };
export type {
  ToolAdapter,
  WrittenConfigBlock,
  WrittenConfig,
  PluginEntry,
  WrittenRuleConfig,
  ScopedRuleConfig,
  ResolvedConfig,
  ResolvedPlugin,
  ResolvedRuleConfig,
};
