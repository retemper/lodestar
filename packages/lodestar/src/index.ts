/**
 * Lodestar — Pluggable, declarative architecture rule engine
 *
 * This is the umbrella package that re-exports the core public API.
 * Users only need to install "lodestar" for basic usage.
 */

// Config helpers
export { defineConfig } from '@lodestar/types';
export { definePlugin, defineRule, definePreset } from '@lodestar/types';

// Config loading
export { loadConfigFile } from '@lodestar/config';
export { resolveConfig } from '@lodestar/config';
export { mergeConfigs } from '@lodestar/config';

// Core engine
export { run, createProviders } from '@lodestar/core';

// Re-export all types
export type {
  // Rule system
  RuleDefinition,
  RuleContext,
  RuleProviders,
  Violation,
  Severity,
  SourceLocation,
  Fix,
  ProviderKey,

  // Plugin system
  Plugin,
  PluginFactory,

  // Config
  WrittenConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  PluginEntry,

  // Providers
  FileSystemProvider,
  DependencyGraphProvider,
  ASTProvider,
  ConfigFileProvider,
  ModuleGraph,
  ModuleNode,
  ImportInfo,
  ExportInfo,

  // Adapter & Preset
  Adapter,
  Preset,
  Reporter,
  RunSummary,
} from '@lodestar/types';

export type { RunOptions } from '@lodestar/core';
