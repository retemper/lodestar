/**
 * Lodestar — Declare your architecture. Enforce it.
 *
 * Project-level rule engine. ESLint checks inside files.
 * Lodestar checks across the project.
 */

// Config helpers
export { defineConfig, definePlugin, defineRule } from '@lodestar/types';

// Config loading
export { loadConfigFile, resolveConfig, discoverWorkspaces } from '@lodestar/config';

// Core engine
export {
  run,
  createProviders,
  runWorkspace,
  validateConfig,
  runRule,
  resolvePlugins,
} from '@lodestar/core';

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
  ToolAdapter,
  WrittenConfigBlock,
  WrittenConfig,
  ScopedRuleConfig,
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

  // Reporter
  Reporter,
  RuleResultSummary,
  RunSummary,
} from '@lodestar/types';

export type {
  RunOptions,
  WorkspaceRunOptions,
  WorkspaceReporter,
  WorkspaceSummary,
  PackageSummary,
} from '@lodestar/core';
export type { WorkspacePackage } from '@lodestar/config';
