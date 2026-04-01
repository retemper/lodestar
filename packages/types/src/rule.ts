import type { JSONSchema7 } from './json-schema.js';

/** Data source identifiers that rules can request */
type ProviderKey = 'fs' | 'graph' | 'ast' | 'config';

/** Source location within a file */
interface SourceLocation {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
}

/** A single rule violation */
interface Violation {
  readonly ruleId: string;
  readonly message: string;
  readonly location?: SourceLocation;
  readonly severity: Severity;
  readonly fix?: Fix;
}

/** Auto-fix descriptor */
interface Fix {
  readonly description: string;
  readonly apply: () => Promise<void>;
}

type Severity = 'error' | 'warn' | 'off';

/** File system provider — read-only operations for rule checks */
interface FileSystemProvider {
  glob(pattern: string): Promise<readonly string[]>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  readJson<T = unknown>(path: string): Promise<T>;
}

/** Dependency graph provider */
interface DependencyGraphProvider {
  getDependencies(file: string): Promise<readonly string[]>;
  getDependents(file: string): Promise<readonly string[]>;
  hasCircular(entry: string): Promise<boolean>;
  getModuleGraph(): Promise<ModuleGraph>;
}

/** Module in the dependency graph */
interface ModuleNode {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
}

/** Full module dependency graph */
interface ModuleGraph {
  readonly nodes: ReadonlyMap<string, ModuleNode>;
}

/** AST provider — on-demand TypeScript AST access */
interface ASTProvider {
  getSourceFile(path: string): Promise<unknown>;
  getImports(path: string): Promise<readonly ImportInfo[]>;
  getExports(path: string): Promise<readonly ExportInfo[]>;
}

/** Parsed import information */
interface ImportInfo {
  readonly source: string;
  readonly specifiers: readonly string[];
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
}

/** Parsed export information */
interface ExportInfo {
  readonly name: string;
  readonly isTypeOnly: boolean;
  readonly isDefault: boolean;
}

/** Config file provider — read project configs like package.json, tsconfig.json */
interface ConfigFileProvider {
  getPackageJson(dir?: string): Promise<Record<string, unknown>>;
  getTsConfig(dir?: string): Promise<Record<string, unknown>>;
  getCustomConfig<T = unknown>(filename: string, dir?: string): Promise<T>;
}

/** Context injected into every rule's check function */
interface RuleContext<TOptions = Record<string, unknown>> {
  readonly rootDir: string;
  readonly options: Readonly<TOptions>;
  readonly providers: RuleProviders;
  report(violation: Omit<Violation, 'ruleId' | 'severity'>): void;
}

/** Provider map accessible from RuleContext */
interface RuleProviders {
  readonly fs: FileSystemProvider;
  readonly graph: DependencyGraphProvider;
  readonly ast: ASTProvider;
  readonly config: ConfigFileProvider;
}

/** Rule definition — the unit of architectural enforcement */
interface RuleDefinition<TOptions = Record<string, unknown>> {
  readonly name: string;
  readonly description: string;
  readonly needs: readonly ProviderKey[];
  readonly schema?: JSONSchema7;
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
  ExportInfo,
  ConfigFileProvider,
  RuleContext,
  RuleProviders,
  RuleDefinition,
};
