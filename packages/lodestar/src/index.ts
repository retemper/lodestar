/**
 * Lodestar — Declare your architecture. Enforce it.
 *
 * Project-level rule engine. ESLint checks inside files.
 * Lodestar checks across the project.
 */

// Config helpers
export { defineConfig, definePlugin, defineRule } from '@retemper/lodestar-types';

// Config loading
export { loadConfigFile, resolveConfig, discoverWorkspaces } from '@retemper/lodestar-config';

// Core engine
export {
  run,
  createProviders,
  runWorkspace,
  validateConfig,
  runRule,
  resolvePlugins,
  createCompositeReporter,
  createDiskCacheProvider,
  createDefaultResolverChain,
  createLogger,
  silentLogger,
  createRelativeResolver,
  createResolverChain,
  createTsconfigPathsResolver,
  createWatcher,
  getChangedFiles,
  computeImpactScope,
  createScopedFsProvider,
} from '@retemper/lodestar-core';

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
  ImportKind,
  ExportInfo,

  // Logger
  LogLevel,
  Logger,

  // Resolver
  ModuleResolver,
  ResolveContext,

  // Reporter
  Reporter,
  WorkspaceReporter,
  WorkspacePackageInfo,
  ReporterFactory,
  ReporterEntry,
  RuleResultSummary,
  RunSummary,
} from '@retemper/lodestar-types';

export type {
  CreateLoggerOptions,
  RunOptions,
  WatchCycleSummary,
  WatcherHandle,
  WatchOptions,
  WorkspaceRunOptions,
  WorkspaceSummary,
  PackageSummary,
} from '@retemper/lodestar-core';
export type { WorkspacePackage } from '@retemper/lodestar-config';
