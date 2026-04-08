# @retemper/lodestar-types

Zero-runtime type definitions shared across all Lodestar packages.

```sh
pnpm add -D @retemper/lodestar-types
```

This package is a peer dependency for plugin authors. It provides the core interfaces that plugins implement.

## Key Exports

```ts
// Rule authoring
export type { RuleDefinition, RuleContext, RuleProviders };

// Providers
export type { FileSystemProvider, DependencyGraphProvider, ASTProvider, ConfigFileProvider };

// Violations
export type { Violation, SourceLocation, Severity, Fix };

// Plugin
export type { PluginDefinition };

// Config
export type { WrittenConfig, ResolvedConfig, WrittenRuleConfig, ResolvedRuleConfig };

// Graph
export type { ModuleGraph, ModuleNode, ImportInfo, ExportInfo };

// Reporter
export type { Reporter, RunSummary };

// Logger
export type { Logger, LogLevel };

// Resolver
export type { Resolver };

// Cache
export type { CacheProvider };

// Helpers
export { defineRule, definePlugin };
```
