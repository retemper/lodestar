import type { JSONSchema7 } from './json-schema';

/** Data source identifiers that rules can request */
type ProviderKey = 'fs' | 'graph' | 'ast' | 'config' | 'git';

/** Source location within a file */
interface SourceLocation {
  /** Absolute or root-relative path to the file */
  readonly file: string;
  /** 1-based line number where the issue starts */
  readonly line?: number;
  /** 1-based column number within the line */
  readonly column?: number;
}

/** A single rule violation */
interface Violation {
  /** Fully qualified rule identifier (e.g., "structure/file-naming") */
  readonly ruleId: string;
  /** Human-readable description of what went wrong */
  readonly message: string;
  /** Where in the source the violation occurred */
  readonly location?: SourceLocation;
  /** How severe this violation is — errors fail the build, warnings do not */
  readonly severity: Severity;
  /** Optional auto-fix that can resolve this violation */
  readonly fix?: Fix;
}

/** Auto-fix descriptor */
interface Fix {
  /** Human-readable explanation of what the fix will do */
  readonly description: string;
  /** Executes the fix, mutating the file system as needed */
  readonly apply: () => Promise<void>;
}

/** Rule enforcement level */
type Severity = 'error' | 'warn' | 'off';

/** File system provider — read-only operations for rule checks */
interface FileSystemProvider {
  /** Find files matching a glob pattern relative to the project root */
  glob(pattern: string): Promise<readonly string[]>;
  /** Read a file's contents as UTF-8 text */
  readFile(path: string): Promise<string>;
  /** Check whether a file or directory exists */
  exists(path: string): Promise<boolean>;
  /** Read and parse a JSON file, returning the typed result */
  readJson<T = unknown>(path: string): Promise<T>;
}

/** Dependency graph provider */
interface DependencyGraphProvider {
  /** List all modules that the given file imports */
  getDependencies(file: string): Promise<readonly string[]>;
  /** List all modules that import the given file */
  getDependents(file: string): Promise<readonly string[]>;
  /** Detect whether the given entry point is part of a circular dependency chain */
  hasCircular(entry: string): Promise<boolean>;
  /** Retrieve the full project module graph for advanced analysis */
  getModuleGraph(): Promise<ModuleGraph>;
}

/** Module in the dependency graph */
interface ModuleNode {
  /** Unique module identifier, typically the file path */
  readonly id: string;
  /** Module IDs that this module imports */
  readonly dependencies: readonly string[];
  /** Module IDs that import this module */
  readonly dependents: readonly string[];
}

/** Full module dependency graph */
interface ModuleGraph {
  /** All modules indexed by their unique ID */
  readonly nodes: ReadonlyMap<string, ModuleNode>;
}

/** AST provider — on-demand TypeScript AST access */
interface ASTProvider {
  /** Parse and return the TypeScript AST source file for the given path */
  getSourceFile(path: string): Promise<unknown>;
  /** Extract all import declarations from the given file */
  getImports(path: string): Promise<readonly ImportInfo[]>;
  /** Extract all export declarations from the given file */
  getExports(path: string): Promise<readonly ExportInfo[]>;
}

/** Import statement kind */
type ImportKind = 'static' | 'require' | 'dynamic';

/** Parsed import information */
interface ImportInfo {
  /** The module specifier string (e.g., "./utils" or "lodash") */
  readonly source: string;
  /** Named import identifiers (e.g., ["useState", "useEffect"]) */
  readonly specifiers: readonly string[];
  /** Whether this is a type-only import (`import type { ... }`) */
  readonly isTypeOnly: boolean;
  /** Position of the import statement in the source file */
  readonly location: SourceLocation;
  /** How this module is imported — static, require(), or dynamic import() */
  readonly kind: ImportKind;
}

/** Parsed export information */
interface ExportInfo {
  /** Exported identifier name */
  readonly name: string;
  /** Whether this is a type-only export (`export type { ... }`) */
  readonly isTypeOnly: boolean;
  /** Whether this is the default export */
  readonly isDefault: boolean;
  /** Present for re-exports (export { x } from './module'). Absent for local declarations. */
  readonly source?: string;
}

/** Config file provider — read project configs like package.json, tsconfig.json */
interface ConfigFileProvider {
  /** Read and parse the nearest package.json, optionally from a specific directory */
  getPackageJson(dir?: string): Promise<Record<string, unknown>>;
  /** Read and parse the nearest tsconfig.json, optionally from a specific directory */
  getTsConfig(dir?: string): Promise<Record<string, unknown>>;
  /** Read and parse an arbitrary config file by name, optionally from a specific directory */
  getCustomConfig<T = unknown>(filename: string, dir?: string): Promise<T>;
}

/** Git provider — read-only git operations for diff-aware rules */
interface GitProvider {
  /** List files staged in the current index */
  stagedFiles(): Promise<readonly string[]>;
  /** List files changed between two refs (defaults head to 'HEAD') */
  diffFiles(base: string, head?: string): Promise<readonly string[]>;
  /** Get the unified diff content for a single file */
  diffContent(
    file: string,
    options?: { staged?: boolean; base?: string },
  ): Promise<string>;
  /** Get the current branch name, or null if in detached HEAD */
  currentBranch(): Promise<string | null>;
  /** Check whether ancestor is an ancestor of descendant (defaults to 'HEAD') */
  isAncestor(ancestor: string, descendant?: string): Promise<boolean>;
}

/** Context injected into every rule's check function */
interface RuleContext<TOptions = Record<string, unknown>> {
  /** Absolute path to the project root directory */
  readonly rootDir: string;
  /** User-supplied options for this rule, validated against the rule's schema */
  readonly options: Readonly<TOptions>;
  /** Data providers (fs, graph, ast, config, git) available for inspection */
  readonly providers: RuleProviders;
  /** Report a violation — ruleId and severity are filled in automatically by the engine */
  report(violation: Omit<Violation, 'ruleId' | 'severity'>): void;
  /** Report check metadata for progress display (e.g., "14 files", "3 deps", "0 cycles") */
  meta(summary: string): void;
}

/** Provider map accessible from RuleContext */
interface RuleProviders {
  /** File system operations (glob, read, exists) */
  readonly fs: FileSystemProvider;
  /** Module dependency graph queries */
  readonly graph: DependencyGraphProvider;
  /** TypeScript AST parsing and inspection */
  readonly ast: ASTProvider;
  /** Project configuration file access */
  readonly config: ConfigFileProvider;
  /** Git operations — available when the project is inside a git repository */
  readonly git?: GitProvider;
}

/** Rule definition — the unit of architectural enforcement */
interface RuleDefinition<TOptions = Record<string, unknown>> {
  /** Unique rule name within its plugin (e.g., "file-naming") */
  readonly name: string;
  /** Short human-readable explanation of what this rule enforces */
  readonly description: string;
  /** Data providers this rule requires — the engine only initializes requested providers */
  readonly needs: readonly ProviderKey[];
  /** JSON Schema for validating user-supplied options */
  readonly schema?: JSONSchema7;
  /** Documentation metadata for error messages and tooling */
  readonly docs?: {
    /** URL to the rule's documentation page */
    readonly url?: string;
  };
  /** Execute the rule check, reporting violations via ctx.report() */
  check(ctx: RuleContext<TOptions>): Promise<void>;
}

export type {
  ProviderKey,
  SourceLocation,
  Violation,
  Fix,
  Severity,
  FileSystemProvider,
  DependencyGraphProvider,
  ModuleNode,
  ModuleGraph,
  ASTProvider,
  ImportInfo,
  ImportKind,
  ExportInfo,
  ConfigFileProvider,
  GitProvider,
  RuleContext,
  RuleProviders,
  RuleDefinition,
};
